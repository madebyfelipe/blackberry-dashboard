"use strict";

/*
 * O seletor de tela: o modal "Compartilhar tela" do desenho, com as telas e
 * janelas de verdade (miniatura atualizada a cada poucos segundos) e — quando
 * a página mandou a qualidade que já usa — resolução, quadros e som do
 * sistema. Devolve a escolha ao processo principal por `window.seletor`
 * (picker-preload.js).
 */

const grade = document.getElementById("grade");
const vazio = document.getElementById("vazio");
const botaoCompartilhar = document.getElementById("compartilhar");
const qualidade = document.getElementById("qualidade");
const som = document.getElementById("som");
const somDica = document.getElementById("som-dica");
const abas = [...document.querySelectorAll("[data-aba]")];
const resolucoes = [...document.querySelectorAll("#resolucao [data-valor]")];
const quadros = [...document.querySelectorAll("#quadros [data-valor]")];

/** @type {{id: string, name: string, kind: "screen" | "window", thumbnail: string, icon: string | null}[]} */
let fontes = [];
let aba = "screen";
let escolhida = null;
let somDisponivel = false;
let escolha = { resolution: "1080p", fps: 30, systemAudio: true };

function iconeDe(kind) {
  const modelo = document.getElementById(kind === "screen" ? "icone-screen" : "icone-window");
  return modelo.content.firstElementChild.cloneNode(true);
}

function desenhar() {
  const visiveis = fontes.filter((f) => f.kind === aba);
  if (escolhida && !fontes.some((f) => f.id === escolhida)) escolhida = null;
  // Uma tela só, na aba Telas: já vem escolhida — é o caso mais comum.
  if (!escolhida && aba === "screen" && visiveis.length === 1) escolhida = visiveis[0].id;

  grade.replaceChildren(
    ...visiveis.map((fonte, i) => {
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
      } else {
        miniatura.append(iconeDe(fonte.kind));
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
      // "Screen 1" / "Entire screen" do sistema vira o nome do desenho.
      texto.textContent =
        fonte.kind === "screen"
          ? fontes.filter((f) => f.kind === "screen").length > 1
            ? `Tela ${i + 1}`
            : "Tela inteira"
          : fonte.name;
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

function marcar(botoes, valor) {
  for (const b of botoes) b.setAttribute("aria-checked", String(b.dataset.valor === String(valor)));
}

function desenharQualidade() {
  marcar(resolucoes, escolha.resolution);
  marcar(quadros, escolha.fps);
  const ligado = somDisponivel && escolha.systemAudio;
  som.setAttribute("aria-checked", String(ligado));
  som.disabled = !somDisponivel;
  somDica.textContent = somDisponivel ? "Transmite o som do computador" : "Só no Windows, por enquanto";
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
  window.seletor.escolher({
    id: escolhida,
    audio: somDisponivel && escolha.systemAudio,
    quality: escolha,
  });
}

function cancelar() {
  window.seletor.cancelar();
}

for (const botao of abas) botao.addEventListener("click", () => trocarAba(botao.dataset.aba));
for (const b of resolucoes)
  b.addEventListener("click", () => {
    escolha = { ...escolha, resolution: b.dataset.valor };
    desenharQualidade();
  });
for (const b of quadros)
  b.addEventListener("click", () => {
    escolha = { ...escolha, fps: Number(b.dataset.valor) };
    desenharQualidade();
  });
som.addEventListener("click", () => {
  if (!somDisponivel) return;
  escolha = { ...escolha, systemAudio: !escolha.systemAudio };
  desenharQualidade();
});
botaoCompartilhar.addEventListener("click", compartilhar);
document.getElementById("cancelar").addEventListener("click", cancelar);
document.getElementById("fechar").addEventListener("click", cancelar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") cancelar();
  if (event.key === "Enter" && !event.target.closest?.("button")) compartilhar();
});

window.seletor.onFontes(({ fontes: novas, somDisponivel: disponivel, qualidade: inicial, transparente }) => {
  const primeira = fontes.length === 0;
  fontes = novas;
  somDisponivel = disponivel;
  if (primeira) {
    document.body.classList.toggle("sem-transparencia", !transparente);
    // Resolução e quadros só aparecem quando a página disse a qualidade que usa
    // (site novo): com o site antigo, ela já foi escolhida no modal do site.
    if (inicial) {
      escolha = { ...escolha, ...inicial };
      qualidade.hidden = false;
    }
    desenharQualidade();
    // Sem tela nenhuma (raro), começa pelas janelas.
    if (!novas.some((f) => f.kind === "screen")) trocarAba("window");
    else desenhar();
    return;
  }
  desenhar();
});
