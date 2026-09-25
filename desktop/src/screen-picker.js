"use strict";

/*
 * O seletor de tela compartilhada (Windows e Linux; no macOS 15+ vale o do
 * sistema). É o modal "Compartilhar tela" do desenho (export "Chamada · Call
 * View"), numa janela do tamanho dele sobre o app: telas e janelas abertas
 * com a miniatura de cada uma, e — quando a página manda a qualidade que usa
 * — resolução, quadros e som do sistema. Devolve a fonte, se o som vai junto
 * e a qualidade escolhida, ou `null` quando a pessoa cancela.
 */

const path = require("node:path");
const { BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const { normalizarQualidade } = require("./share-quality");

const MINIATURA = { width: 320, height: 180 };
const ATUALIZA_A_CADA_MS = 3000;
/** Som do sistema só sai no Windows ("loopback"); no Linux não há. */
const SOM_DISPONIVEL = process.platform === "win32";

/**
 * Janela transparente (para os cantos de 16px do modal) no Windows e no
 * macOS. No Linux depende do compositor — lá a janela é sólida e sem cantos.
 */
const TRANSPARENTE = process.platform !== "linux";

/** Um seletor por vez: um segundo pedido enquanto ele está aberto é recusado. */
let aberto = false;

/**
 * @param {BrowserWindow} pai
 * @param {{ resolution: string, fps: number, systemAudio: boolean } | null} [qualidade]
 *   A qualidade que a página usa hoje. Com ela o seletor mostra resolução e
 *   quadros; sem ela (site antigo), só a fonte e o som.
 * @returns {Promise<{ source: Electron.DesktopCapturerSource, audio: boolean, quality: ReturnType<typeof normalizarQualidade> } | null>}
 */
async function escolherFonte(pai, qualidade = null) {
  if (aberto) return null;
  aberto = true;

  const janela = new BrowserWindow({
    parent: pai,
    modal: true,
    // O modal do desenho: 480 de largura; a altura cabe duas linhas de fontes
    // e a qualidade (sem ela, sobra espaço para mais fontes).
    width: 480,
    height: qualidade ? 724 : 540,
    frame: false,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    transparent: TRANSPARENTE,
    backgroundColor: TRANSPARENTE ? "#00000000" : "#1b1b1b",
    hasShadow: true,
    title: "Compartilhar tela",
    webPreferences: {
      preload: path.join(__dirname, "picker", "picker-preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  janela.setMenu(null);
  const wc = janela.webContents;
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
  wc.on("will-navigate", (event) => event.preventDefault());

  /** @type {Map<string, Electron.DesktopCapturerSource>} */
  let fontes = new Map();

  async function atualizar() {
    let lista;
    try {
      lista = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: MINIATURA,
        fetchWindowIcons: true,
      });
    } catch {
      return;
    }
    if (janela.isDestroyed()) return;
    const proprio = janela.getMediaSourceId();
    lista = lista.filter((f) => f.id !== proprio);
    fontes = new Map(lista.map((f) => [f.id, f]));
    wc.send("seletor:fontes", {
      somDisponivel: SOM_DISPONIVEL,
      qualidade,
      transparente: TRANSPARENTE,
      fontes: lista.map((f) => ({
        id: f.id,
        name: f.name,
        kind: f.id.startsWith("screen:") ? "screen" : "window",
        thumbnail: f.thumbnail.isEmpty() ? "" : f.thumbnail.toDataURL(),
        icon: f.appIcon && !f.appIcon.isEmpty() ? f.appIcon.toDataURL() : null,
      })),
    });
  }

  return new Promise((resolve) => {
    let intervalo = null;
    let resolvido = false;

    const terminar = (resultado) => {
      if (resolvido) return;
      resolvido = true;
      aberto = false;
      clearInterval(intervalo);
      ipcMain.removeListener("seletor:escolher", aoEscolher);
      ipcMain.removeListener("seletor:cancelar", aoCancelar);
      if (!janela.isDestroyed()) janela.destroy();
      resolve(resultado);
    };

    function aoEscolher(event, escolha) {
      if (event.sender !== wc) return;
      const source = fontes.get(escolha?.id);
      terminar(
        source
          ? {
              source,
              audio: SOM_DISPONIVEL && escolha.audio === true,
              // Qualidade só volta se o seletor a mostrou (a página pediu).
              quality: qualidade ? normalizarQualidade(escolha.quality) : null,
            }
          : null,
      );
    }
    function aoCancelar(event) {
      if (event.sender === wc) terminar(null);
    }

    ipcMain.on("seletor:escolher", aoEscolher);
    ipcMain.on("seletor:cancelar", aoCancelar);
    janela.on("closed", () => terminar(null));

    wc.once("did-finish-load", async () => {
      await atualizar();
      if (janela.isDestroyed()) return;
      janela.show();
      intervalo = setInterval(atualizar, ATUALIZA_A_CADA_MS);
    });
    void janela.loadFile(path.join(__dirname, "picker", "picker.html"));
  });
}

module.exports = { escolherFonte };
