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
  /**
   * 0.0.7+: o seletor de tela é o modal do desenho, com resolução, quadros e
   * som. `false` no macOS, onde vale o seletor do sistema — lá a página
   * segue com o modal dela.
   */
  sharePicker: process.platform !== "darwin",
  /** A qualidade que a página usa hoje — o seletor abre com ela marcada. */
  setShareQuality(qualidade) {
    ipcRenderer.send("desktop:qualidade-tela", qualidade);
  },
  /** O que foi escolhido no seletor (uma vez só), ou `null`. */
  takeShareQuality() {
    return ipcRenderer.invoke("desktop:escolha-tela");
  },
  /** Atalho global de mudo apertado. Devolve a função que para de ouvir. */
  onToggleMute(callback) {
    if (typeof callback !== "function") return () => {};
    const ouvir = () => callback();
    ipcRenderer.on("desktop:alternar-mudo", ouvir);
    return () => ipcRenderer.removeListener("desktop:alternar-mudo", ouvir);
  },
});
