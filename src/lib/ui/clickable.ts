import type { KeyboardEvent } from "react";

/*
 * Um bloco inteiro que abre algo no clique — a linha da lista, o card do
 * quadro — também precisa abrir pelo teclado: entra no Tab e responde a Enter
 * e Espaço, como um botão. Sem isso, Tarefas, Clientes e Social media só se
 * navegavam com o mouse.
 *
 * Só reage à tecla no próprio bloco: Enter na caixa de seleção ou no "⋯" de
 * dentro dele continua sendo daquele controle, não abre a linha.
 */
export function clickableProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}
