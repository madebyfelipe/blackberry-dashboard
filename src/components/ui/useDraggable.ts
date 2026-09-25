"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Um elemento `position: fixed` que a pessoa arrasta pela tela — o cartão da
 * chamada no canto, como o do Discord. A posição fica guardada no navegador
 * (`storageKey`) e volta para dentro da tela quando a janela encolhe.
 *
 * Arrastar e clicar moram no mesmo cartão: só vira arrasto depois de alguns
 * pixels, e aí o clique que viria ao soltar é engolido — senão soltar o
 * cartão abriria a chamada.
 */

export type Point = { x: number; y: number };

/** Quantos pixels o ponteiro anda antes de o toque virar arrasto. */
const DRAG_THRESHOLD = 5;

/** Mantém o retângulo inteiro dentro da tela, com uma folga nas bordas. */
export function clampToViewport(
  pos: Point,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): Point {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, pos.x))),
    y: Math.round(Math.min(maxY, Math.max(margin, pos.y))),
  };
}

function load(key: string): Point | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) ? { x: raw.x, y: raw.y } : null;
  } catch {
    return null;
  }
}

export function useDraggable<T extends HTMLElement>(storageKey: string) {
  const ref = useRef<T>(null);
  /** `null` = no lugar padrão das classes (canto de baixo, à direita). */
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; start: Point; origin: Point; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  const fit = useCallback((p: Point) => {
    const el = ref.current;
    if (!el) return p;
    return clampToViewport(p, el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
  }, []);

  // A posição guardada, ajustada a esta tela (o monitor pode ter mudado).
  useEffect(() => {
    const saved = load(storageKey);
    if (saved) setPos(fit(saved));
  }, [storageKey, fit]);

  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? fit(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, fit]);

  /*
   * O movimento é ouvido na janela, não no cartão: o ponteiro sai de cima
   * dele no primeiro puxão, e aí o cartão deixaria de receber os eventos.
   * (Capturar o ponteiro no cartão resolveria isso, mas roubaria o clique
   * dos botões dele.)
   */
  const onPointerDown = (e: React.PointerEvent<T>) => {
    if (e.button !== 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const d = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: { x: rect.left, y: rect.top }, moved: false };
    drag.current = d;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      const dx = ev.clientX - d.start.x;
      const dy = ev.clientY - d.start.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        setDragging(true);
      }
      ev.preventDefault();
      setPos(fit({ x: d.origin.x + dx, y: d.origin.y + dy }));
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      drag.current = null;
      if (!d.moved) return;
      setDragging(false);
      swallowClick.current = true;
      // O clique do soltar vem logo em seguida; se não vier (soltou fora), esquece.
      setTimeout(() => (swallowClick.current = false), 0);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(p));
          } catch {
            // Sem armazenamento: vale até recarregar.
          }
        }
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // O clique que o navegador dispara ao soltar um arrasto não é um clique.
  const onClickCapture = (e: React.MouseEvent<T>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    ref,
    dragging,
    /** Com posição: `left`/`top` e as bordas padrão desligadas. */
    style: pos ? ({ left: pos.x, top: pos.y, right: "auto", bottom: "auto" } as const) : undefined,
    handlers: {
      onPointerDown,
      onClickCapture,
    },
  };
}
