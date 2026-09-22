"use strict";

/* A ponte do seletor de tela com o processo principal — só isto. */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seletor", {
  onFontes(callback) {
    ipcRenderer.on("seletor:fontes", (_e, dados) => callback(dados));
  },
  escolher(escolha) {
    ipcRenderer.send("seletor:escolher", escolha);
  },
  cancelar() {
    ipcRenderer.send("seletor:cancelar");
  },
});
