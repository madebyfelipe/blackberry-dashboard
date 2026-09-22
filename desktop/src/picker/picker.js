"use strict";

/*
 * O seletor de tela: lista janelas e telas (com miniatura) e devolve a
 * escolha ao processo principal por `window.seletor` (picker-preload.js).
 * As miniaturas chegam de novo a cada poucos segundos; a escolha fica.
 */

const grade = document.getElementById("grade");
const vazio = document.getElementById("vazio");
const botaoCompartilhar = document.getElementById("compartilhar");
const som = document.getElementById("som");
const somRotulo = document.getElementById("som-rotulo");
const abas = [...document.querySelectorAll("[data-aba]")];

/** @type {{id: string, name: string, kind: "screen" | "window", thumbnail: string, icon: string | null}[]} */
let fontes = [];
let aba = "window";
let escolhida = null;

function desenhar() {
  const visiveis = fontes.filter((f) => f.kind === aba);
  if (escolhida && !fontes.some((f) => f.id === escolhida)) escolhida = null;

  grade.replaceChildren(
    ...visiveis.map((fonte) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "fonte";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(fonte.id === escolhida));
      item.title = fonte.name;

      const miniatura = document.createElement("div");
      miniatura.className = "miniatura";
      if (fonte.thumbnail) {
        const img = document.createElement("img");
        img.src = fonte.thumbnail;
        img.alt = "";
        miniatura.append(img);
      }

      const nome = document.createElement("div");
      nome.className = "nome";
      if (fonte.icon) {
        const icone = document.createElement("img");
        icone.src = fonte.icon;
        icone.alt = "";
        nome.append(icone);
      }
      const texto = document.createElement("span");
      texto.textContent = fonte.name;
      nome.append(texto);

      item.append(miniatura, nome);
      item.addEventListener("click", () => {
        escolhida = fonte.id;
        desenhar();
      });
      item.addEventListener("dblclick", () => {
        escolhida = fonte.id;
        compartilhar();
      });
      return item;
    }),
  );

  vazio.hidden = visiveis.length > 0;
  grade.hidden = visiveis.length === 0;
  botaoCompartilhar.disabled = !escolhida;
}

function trocarAba(nova) {
  aba = nova;
  for (const botao of abas) {
    botao.setAttribute("aria-selected", String(botao.dataset.aba === nova));
  }
  desenhar();
}

function compartilhar() {
  if (!escolhida) return;
  window.seletor.escolher({ id: escolhida, audio: !somRotulo.hidden && som.checked });
}

function cancelar() {
  window.seletor.cancelar();
}

for (const botao of abas) botao.addEventListener("click", () => trocarAba(botao.dataset.aba));
botaoCompartilhar.addEventListener("click", compartilhar);
document.getElementById("cancelar").addEventListener("click", cancelar);
document.getElementById("fechar").addEventListener("click", cancelar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") cancelar();
  if (event.key === "Enter" && !event.target.closest?.(".fonte, .abas, .acoes")) compartilhar();
});

window.seletor.onFontes(({ fontes: novas, somDisponivel }) => {
  const primeira = fontes.length === 0;
  fontes = novas;
  somRotulo.hidden = !somDisponivel;
  // Sem nenhuma janela aberta, começa pelas telas.
  if (primeira && !novas.some((f) => f.kind === "window")) trocarAba("screen");
  else desenhar();
});
