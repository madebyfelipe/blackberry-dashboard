"use strict";

/*
 * O seletor de tela compartilhada (Windows e Linux; no macOS 15+ vale o do
 * sistema). Uma janelinha modal sobre o app, com as janelas e telas abertas e
 * a miniatura de cada uma, como o do Discord. Devolve a fonte escolhida e se
 * o som vai junto, ou `null` quando a pessoa cancela.
 */

const path = require("node:path");
const { BrowserWindow, desktopCapturer, ipcMain } = require("electron");

const MINIATURA = { width: 320, height: 180 };
const ATUALIZA_A_CADA_MS = 3000;
/** Som do sistema só sai no Windows ("loopback"); no Linux não há. */
const SOM_DISPONIVEL = process.platform === "win32";

/** Um seletor por vez: um segundo pedido enquanto ele está aberto é recusado. */
let aberto = false;

/**
 * @param {BrowserWindow} pai
 * @returns {Promise<{ source: Electron.DesktopCapturerSource, audio: boolean } | null>}
 */
async function escolherFonte(pai) {
  if (aberto) return null;
  aberto = true;

  const janela = new BrowserWindow({
    parent: pai,
    modal: true,
    width: 760,
    height: 560,
    minWidth: 480,
    minHeight: 360,
    frame: false,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#141414",
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
      terminar(source ? { source, audio: SOM_DISPONIVEL && escolha.audio === true } : null);
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
