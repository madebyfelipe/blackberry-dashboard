"use strict";

/*
 * black berry para desktop — o processo principal do Electron.
 *
 * O app é uma janela que abre o black berry publicado (a mesma Vercel do
 * navegador). Nenhuma tela mora aqui: toda deploy nova chega no desktop sem
 * reinstalar nada. O que o Electron acrescenta é o que o navegador não dá:
 *
 * - fica na bandeja ao fechar a janela (Windows e macOS), então o Inbox e a
 *   chamada seguem vivos e as notificações continuam chegando;
 * - um atalho global de mudo (Ctrl/Cmd+Shift+M) que funciona com outra
 *   janela na frente, ligado só enquanto há chamada;
 * - microfone, câmera e tela compartilhada liberados para o black berry, e
 *   só para ele (ver `policy.js`).
 */

const path = require("node:path");
const fs = require("node:fs");
const { execFile } = require("node:child_process");
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  WebContentsView,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  session,
  shell,
} = require("electron");
const {
  allowsPermission,
  canOpenExternally,
  isAppUrl,
  resolveAppOrigin,
} = require("./policy");
const { escolherFonte } = require("./screen-picker");
const pkg = require("../package.json");

/** `--url=` na linha de comando (o `npm run dev`) ou `BLACKBERRY_URL`. */
const URL_ARG = process.argv.find((a) => a.startsWith("--url="))?.slice("--url=".length);
const APP_ORIGIN = resolveAppOrigin(
  URL_ARG || process.env.BLACKBERRY_URL,
  pkg.blackberry?.url,
);
const ATALHO_MUDO = "CommandOrControl+Shift+M";
/** No Linux a bandeja depende do ambiente gráfico: lá, fechar é sair. */
const FICA_NA_BANDEJA = process.platform !== "linux";

/** Altura da barra de título preta, acima do site. */
const ALTURA_BARRA = 32;

/** @type {BrowserWindow | null} */
let janela = null;
/** A página do black berry, abaixo da barra de título. @type {Electron.WebContents | null} */
let pagina = null;
/** @type {Tray | null} */
let bandeja = null;
let saindo = false;

/*
 * Sem a moldura amarela do Windows em volta da janela ou tela transmitida.
 * A captura (Windows Graphics Capture) pede a borda por padrão; o Chromium
 * deixa desligar por esta chave, e o seletor do app já deixa claro o que está
 * sendo mostrado. Precisa vir antes do `ready`.
 */
if (process.platform === "win32") {
  app.commandLine.appendSwitch("disable-features", "WebRtcWgcRequireBorder");
}

// Uma instância só: abrir o app de novo traz a janela que já existe.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrar);
  app.whenReady().then(iniciar);
}

const APP_USER_MODEL_ID = "app.blackberry.desktop";

/*
 * O cabeçalho das notificações do Windows: "Black Berry" com o logo. O
 * Windows tira o nome e o ícone do registro do AppUserModelID (sem isso usa o
 * nome do atalho, em minúsculas). É uma chave do próprio usuário, só deste
 * app — refeita a cada abertura, então se corrige sozinha numa atualização.
 * O ícone fica fora do .asar, porque o Windows não lê dentro dele.
 */
function registrarNomeDasNotificacoes() {
  const icone = path.join(__dirname, "notificacao.png").replace("app.asar", "app.asar.unpacked");
  const chave = ["HKCU", "Software", "Classes", "AppUserModelId", APP_USER_MODEL_ID].join("\\");
  const gravar = (nome, valor) =>
    execFile("reg", ["add", chave, "/v", nome, "/t", "REG_SZ", "/d", valor, "/f"], { windowsHide: true }, () => {});
  gravar("DisplayName", "Black Berry");
  if (fs.existsSync(icone)) gravar("IconUri", icone);
}

function mostrar() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

async function iniciar() {
  if (process.platform === "win32") {
    app.setAppUserModelId(APP_USER_MODEL_ID);
    registrarNomeDasNotificacoes();
  }

  if (!APP_ORIGIN) {
    dialog.showErrorBox(
      "black berry",
      "Endereço do black berry não configurado. Defina BLACKBERRY_URL " +
        "(ou blackberry.url no package.json do app de desktop) com o endereço https.",
    );
    app.quit();
    return;
  }

  preferencias = lerPreferencias();
  protegerSessao(session.defaultSession);
  criarJanela();
  criarBandeja();
  ouvirChamada();
  ouvirPagina();

  app.on("activate", mostrar); // clique no ícone do Dock
}

/* --------------------------------------------------------------- sessão -- */

function protegerSessao(sessao) {
  sessao.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(allowsPermission(permission, details.requestingUrl || wc.getURL(), APP_ORIGIN));
  });
  sessao.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    allowsPermission(permission, requestingOrigin, APP_ORIGIN),
  );

  /*
   * Tela compartilhada. O Electron não tem o seletor do Chrome: no macOS 15+
   * vale o do próprio sistema (`useSystemPicker`, e aí este handler nem roda);
   * no resto abre o nosso (screen-picker.js), com janelas e telas como o do
   * Discord. Cancelar devolve `{}`, e o getDisplayMedia da página rejeita.
   */
  sessao.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (!janela || !isAppUrl(request.securityOrigin || request.frame?.url || "", APP_ORIGIN)) {
        return callback({});
      }
      try {
        const escolha = await escolherFonte(janela);
        if (!escolha) return callback({});
        callback(
          escolha.audio && request.audioRequested
            ? { video: escolha.source, audio: "loopback" }
            : { video: escolha.source },
        );
      } catch {
        callback({});
      }
    },
    { useSystemPicker: true },
  );
}

/* ---------------------------------------------------------- preferências -- */

const ARQUIVO_PREFERENCIAS = () => path.join(app.getPath("userData"), "preferencias.json");

/** Minimizar manda para a bandeja (em vez da barra de tarefas). Ligado por padrão. */
function lerPreferencias() {
  try {
    const salvo = JSON.parse(fs.readFileSync(ARQUIVO_PREFERENCIAS(), "utf8"));
    return { minimizarParaBandeja: salvo.minimizarParaBandeja !== false };
  } catch {
    return { minimizarParaBandeja: true };
  }
}

let preferencias = { minimizarParaBandeja: true };

function gravarPreferencias() {
  try {
    fs.writeFileSync(ARQUIVO_PREFERENCIAS(), JSON.stringify(preferencias));
  } catch {
    // Não gravar a preferência não impede nada: vale até fechar o app.
  }
}

/* --------------------------------------------------------------- janela -- */

const ARQUIVO_JANELA = () => path.join(app.getPath("userData"), "janela.json");

function lerPosicao() {
  try {
    const salvo = JSON.parse(fs.readFileSync(ARQUIVO_JANELA(), "utf8"));
    if (Number.isFinite(salvo.width) && Number.isFinite(salvo.height)) return salvo;
  } catch {
    // Primeira vez, ou arquivo corrompido: tamanho padrão.
  }
  return { width: 1280, height: 820 };
}

function gravarPosicao() {
  if (!janela || janela.isDestroyed() || janela.isMinimized()) return;
  try {
    fs.writeFileSync(ARQUIVO_JANELA(), JSON.stringify(janela.getNormalBounds()));
  } catch {
    // Não gravar a posição não impede nada.
  }
}

function criarJanela() {
  janela = new BrowserWindow({
    ...lerPosicao(),
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: "black berry",
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    /*
     * Barra de título preta, a cor do fundo do app: a janela esconde a barra
     * do sistema e desenha a sua (titlebar.html); os botões de janela seguem
     * sendo os do sistema, pintados por cima.
     */
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 12, y: 10 } }
      : { titleBarOverlay: { color: "#000000", symbolColor: "#ffffff", height: ALTURA_BARRA } }),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  janela.webContents.on("will-navigate", (event) => event.preventDefault());
  void janela.loadFile(path.join(__dirname, "titlebar.html"));

  // O site mora numa view abaixo da barra, ocupando o resto da janela.
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Janela escondida na bandeja continua recebendo mensagem e chamada.
      backgroundThrottling: false,
      spellcheck: true,
    },
  });
  view.setBackgroundColor("#000000");
  janela.contentView.addChildView(view);
  const encaixar = () => {
    if (!janela || janela.isDestroyed()) return;
    const { width, height } = janela.getContentBounds();
    // Em tela cheia não há barra de título.
    const topo = janela.isFullScreen() ? 0 : ALTURA_BARRA;
    view.setBounds({ x: 0, y: topo, width, height: Math.max(0, height - topo) });
  };
  encaixar();
  janela.on("resize", encaixar);
  janela.on("enter-full-screen", encaixar);
  janela.on("leave-full-screen", encaixar);
  // O teclado vai para o site, não para a barra.
  janela.on("focus", () => pagina?.focus());

  /*
   * Não dá para esperar o `ready-to-show`: coberta pela view, a barra nunca
   * pinta e o evento não vem. A barra é um arquivo local e o fundo da janela
   * já é preto, então mostrar assim que ela carrega não pisca nada.
   */
  janela.webContents.once("did-finish-load", () => janela?.show());

  const wc = view.webContents;
  pagina = wc;
  // Tela cheia pedida pelo site (o vídeo da chamada) vira tela cheia da janela.
  wc.on("enter-html-full-screen", () => janela?.setFullScreen(true));
  wc.on("leave-html-full-screen", () => janela?.setFullScreen(false));

  // Link de fora da origem abre no navegador do sistema; nunca dentro do app.
  wc.setWindowOpenHandler(({ url }) => {
    if (canOpenExternally(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (isAppUrl(url, APP_ORIGIN)) return;
    event.preventDefault();
    if (canOpenExternally(url)) void shell.openExternal(url);
  });
  wc.on("will-redirect", (event, url) => {
    if (!isAppUrl(url, APP_ORIGIN)) event.preventDefault();
  });

  // Página recarregada ou travada no meio da chamada: o atalho de mudo solta.
  wc.on("did-navigate", () => globalShortcut.unregister(ATALHO_MUDO));
  wc.on("render-process-gone", () => globalShortcut.unregister(ATALHO_MUDO));

  // Sem internet ou servidor fora do ar: avisa e deixa tentar de novo.
  wc.on("did-fail-load", async (_e, codigo, descricao, url, principal) => {
    if (!principal || codigo === -3 /* ERR_ABORTED: navegação trocada */) return;
    const { response } = await dialog.showMessageBox(janela, {
      type: "warning",
      buttons: ["Tentar de novo", "Sair"],
      defaultId: 0,
      cancelId: 1,
      message: "Não deu para abrir o black berry.",
      detail: `${descricao} (${codigo})\n${url}`,
    });
    if (response === 0) void wc.loadURL(url || APP_ORIGIN);
    else sair();
  });

  janela.on("close", (event) => {
    gravarPosicao();
    if (FICA_NA_BANDEJA && !saindo) {
      event.preventDefault();
      janela?.hide();
    }
  });
  /*
   * Minimizar vai para a bandeja, como o Discord: some da barra de tarefas e
   * volta pelo ícone ao lado do relógio. Dá para desligar no menu da bandeja.
   */
  janela.on("minimize", () => {
    if (FICA_NA_BANDEJA && preferencias.minimizarParaBandeja) {
      gravarPosicao();
      janela?.hide();
    }
  });
  // Voltar para a janela para de piscar na barra de tarefas.
  janela.on("focus", () => janela?.flashFrame(false));
  janela.on("closed", () => {
    janela = null;
    pagina = null;
    if (!wc.isDestroyed()) wc.close();
  });

  void wc.loadURL(APP_ORIGIN);
}

/* -------------------------------------------------------------- bandeja -- */

function criarBandeja() {
  if (!FICA_NA_BANDEJA) return;
  // O símbolo do logo oficial; o `tray@2x.png` ao lado entra sozinho em tela HiDPI.
  const icone = nativeImage.createFromPath(path.join(__dirname, "tray.png"));
  if (process.platform === "darwin") icone.setTemplateImage(true);
  bandeja = new Tray(icone);
  bandeja.setToolTip("black berry");
  montarMenuBandeja();
  bandeja.on("click", mostrar);
}

function montarMenuBandeja() {
  if (!bandeja) return;
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir black berry", click: mostrar },
      { type: "separator" },
      {
        label: "Minimizar para a bandeja",
        type: "checkbox",
        checked: preferencias.minimizarParaBandeja,
        click: (item) => {
          preferencias.minimizarParaBandeja = item.checked;
          gravarPreferencias();
        },
      },
      { type: "separator" },
      { label: "Sair", click: sair },
    ]),
  );
}

/* ------------------------------------------------------ avisos da página -- */

let naoLidas = 0;

/**
 * O que a página conta para o app: as não lidas do Inbox (dica da bandeja,
 * contador no Dock/Linux, e a barra de tarefas piscando quando chega coisa
 * nova com a janela atrás de outras) e o pedido de trazer a janela — o
 * clique numa notificação precisa abrir o app mesmo escondido na bandeja.
 */
function ouvirPagina() {
  ipcMain.on("desktop:mostrar", (event) => {
    if (!pagina || event.sender !== pagina) return;
    mostrar();
  });
  ipcMain.on("desktop:nao-lidas", (event, total) => {
    if (!pagina || event.sender !== pagina) return;
    const n = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
    bandeja?.setToolTip(n > 0 ? `black berry — ${n} não ${n === 1 ? "lida" : "lidas"}` : "black berry");
    app.setBadgeCount(n);
    if (n > naoLidas && janela && !janela.isFocused()) janela.flashFrame(true);
    naoLidas = n;
  });
}

function sair() {
  saindo = true;
  app.quit();
}

app.on("before-quit", () => {
  saindo = true;
});

app.on("window-all-closed", () => {
  // Só chega aqui quando a janela fechou de verdade (Linux, ou "Sair").
  app.quit();
});

app.on("will-quit", () => globalShortcut.unregisterAll());

/* ------------------------------------------------------------- chamada -- */

/**
 * A página avisa quando entra e sai da chamada; enquanto ela durar, o atalho
 * de mudo é global. Fora da chamada o atalho fica livre para os outros apps.
 */
function ouvirChamada() {
  ipcMain.on("desktop:em-chamada", (event, emChamada) => {
    if (!pagina || event.sender !== pagina) return;
    if (!isAppUrl(event.senderFrame?.url ?? "", APP_ORIGIN)) return;

    if (emChamada === true) {
      if (globalShortcut.isRegistered(ATALHO_MUDO)) return;
      globalShortcut.register(ATALHO_MUDO, () => {
        pagina?.send("desktop:alternar-mudo");
      });
    } else {
      globalShortcut.unregister(ATALHO_MUDO);
    }
  });
}
