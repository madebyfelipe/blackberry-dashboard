"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Teclado dos menus flutuantes de ações.
 *
 * O gatilho anuncia `aria-haspopup="menu"`, e quem usa teclado ou leitor de
 * tela espera, a partir daí, andar pelos itens com as setas. Este hook é o que
 * sustenta a promessa: foca o primeiro item quando o painel abre, circula com
 * ↑/↓/Home/End e, no Esc, fecha devolvendo o foco ao botão que abriu — sem ele
 * o `aria-haspopup` seria propaganda enganosa (foi por isso que o botão redondo
 * do lote, que abre um grupo de controles e não um menu, não ganhou o atributo).
 */
export function useMenuKeys(open: boolean, close: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const items = useCallback(
    () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]',
        ) ?? [],
      ),
    [],
  );

  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open, items]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }

    const list = items();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next =
        at < 0
          ? step === 1
            ? 0
            : list.length - 1
          : (at + step + list.length) % list.length;
      list[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    }
  }

  return { menuRef, triggerRef, onKeyDown };
}
