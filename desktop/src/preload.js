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
  /** Atalho global de mudo apertado. Devolve a função que para de ouvir. */
  onToggleMute(callback) {
    if (typeof callback !== "function") return () => {};
    const ouvir = () => callback();
    ipcRenderer.on("desktop:alternar-mudo", ouvir);
    return () => ipcRenderer.removeListener("desktop:alternar-mudo", ouvir);
  },
});
