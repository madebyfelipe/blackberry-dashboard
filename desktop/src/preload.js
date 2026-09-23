"use strict";

/*
 * A ponte entre a página do black berry e o app de desktop. É tudo que a
 * página enxerga do Electron — nada de Node, nada de `ipcRenderer` cru:
 * `window.blackberryDesktop`, com o formato descrito em `src/lib/desktop.ts`
 * do app web. No navegador comum ela não existe, e a página segue igual.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("blackberryDesktop", {
  platform: process.platform,
  /** A página entrou (true) ou saiu (false) de uma chamada. */
  setInCall(emChamada) {
    ipcRenderer.send("desktop:em-chamada", emChamada === true);
  },
  /** Traz a janela para a frente — o clique numa notificação, com o app na bandeja. */
  show() {
    ipcRenderer.send("desktop:mostrar");
  },
  /** As não lidas do Inbox: dica da bandeja, contador e a barra piscando. */
  setUnread(total) {
    ipcRenderer.send("desktop:nao-lidas", Number(total) || 0);
  },
  /** Atalho global de mudo apertado. Devolve a função que para de ouvir. */
  onToggleMute(callback) {
    if (typeof callback !== "function") return () => {};
    const ouvir = () => callback();
    ipcRenderer.on("desktop:alternar-mudo", ouvir);
    return () => ipcRenderer.removeListener("desktop:alternar-mudo", ouvir);
  },
});
