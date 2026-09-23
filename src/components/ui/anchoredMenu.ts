"use client";

import { useEffect } from "react";

/*
 * Onde um menu flutuante abre, a partir do botão que o abriu.
 *
 * Por que os menus das linhas saem por portal: toda linha e todo card do
 * produto entra com `.stagger-item`, e a animação dele usa `transform`. Um
 * elemento com `transform` vira o próprio contexto de empilhamento — o
 * `z-50` do menu passa a valer só dentro da linha, e a linha de baixo (que
 * vem depois no DOM) é pintada por cima dele. Fora da linha, no `body`, o
 * menu volta a ficar acima de tudo.
 */

export type MenuPosition = { top: number; left: number; maxHeight: number };

const GAP = 4;
const MARGIN = 8;

/**
 * Encosta o menu na borda do botão (direita ou esquerda) e abre para baixo;
 * sem espaço embaixo, abre para cima. Nunca sai da tela.
 */
export function anchorMenu(
  trigger: DOMRect,
  menu: { width: number; height: number },
  align: "left" | "right" = "right",
): MenuPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(
    MARGIN,
    Math.min(align === "right" ? trigger.right - menu.width : trigger.left, vw - menu.width - MARGIN),
  );
  const below = vh - trigger.bottom - GAP - MARGIN;
  const above = trigger.top - GAP - MARGIN;
  const openUp = below < menu.height && above > below;
  const top = openUp ? Math.max(MARGIN, trigger.top - GAP - Math.min(menu.height, above)) : trigger.bottom + GAP;
  return { top, left, maxHeight: Math.max(120, openUp ? above : below) };
}

/** Rolar ou redimensionar com o menu aberto o fecha — ele não acompanharia o botão. */
export function useCloseOnScroll(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);
}
