"use client";

import { useSyncExternalStore } from "react";

/*
 * Abaixo do `md` (768px) — o mesmo corte das classes `md:` do produto. Para
 * o que CSS sozinho não resolve: abrir um menu como folha de baixo em vez de
 * dropdown, encurtar um texto de placeholder.
 */
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // No servidor não há tela: renderiza como desktop, e o cliente acerta.
    () => false,
  );
}

/** Aparelho de toque (sem hover de verdade) — o long-press no lugar do hover. */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
}
