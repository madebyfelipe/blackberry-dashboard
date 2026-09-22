"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Client } from "@/lib/clients/types";
import { CLIENT_STATUS_BY_ID } from "@/lib/clients/constants";
import { Badge } from "@/components/ui/Badge";
import { EntityMark } from "@/components/ui/Mark";

/*
 * O cartão que aparece ao passar o ponteiro sobre o nome do cliente (export
 * "hover clientes"): 262px, a marca e o nome no topo, régua, e as linhas
 * Status, Empresa, Cidade, E-mail e Telefone.
 *
 * Duas decisões que o desenho não diz e valem registrar:
 *
 * 1. Ele sai por um portal no `body`. A linha da lista anima com `transform`
 *    e `fill-mode: both` (`.stagger-item`), e um elemento `fixed` dentro de um
 *    ancestral com transform passa a se posicionar *nele*, não no viewport —
 *    o cartão nasceria torto e cortado pelo `overflow` da tabela.
 * 2. Ele é leitura, não menu: não recebe foco nem clique, e some assim que o
 *    ponteiro sai do nome. Quem está no teclado ou no celular abre a ficha
 *    (Enter/toque na linha), que mostra os mesmos campos e deixa editar.
 */

const WIDTH = 262;
const OPEN_DELAY = 220;
const MARGIN = 12;

export function ClientHoverCard({
  client,
  children,
}: {
  client: Client;
  children: React.ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /*
   * O cartão abre embaixo do nome; se não couber, sobe. A altura só se conhece
   * depois de ele existir, então a primeira posição vem de uma estimativa e o
   * efeito abaixo corrige antes da pintura.
   */
  function place() {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    setAt({
      left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - WIDTH - MARGIN)),
      top: rect.bottom + 8,
    });
  }

  function open() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(place, OPEN_DELAY);
  }

  function close() {
    if (timer.current) clearTimeout(timer.current);
    setAt(null);
  }

  useEffect(() => {
    if (!at || !card.current) return;
    const rect = card.current.getBoundingClientRect();
    if (rect.bottom <= window.innerHeight - MARGIN) return;
    const above = (anchor.current?.getBoundingClientRect().top ?? 0) - rect.height - 8;
    setAt((prev) =>
      prev ? { ...prev, top: Math.max(MARGIN, above) } : prev,
    );
    // Só reposiciona quando o cartão acabou de abrir num lugar novo.
  }, [at]);

  // Rolar ou redimensionar com o cartão aberto tiraria ele do lugar.
  useEffect(() => {
    if (!at) return;
    const onMove = () => close();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [at]);

  const status = CLIENT_STATUS_BY_ID[client.status];

  return (
    <span
      ref={anchor}
      onPointerEnter={(e) => e.pointerType === "mouse" && open()}
      onPointerLeave={close}
      onPointerDown={close}
      className="flex min-w-0 items-center gap-2.5"
    >
      {children}

      {at !== null &&
        createPortal(
          <div
            ref={card}
            role="tooltip"
            style={{ left: at.left, top: at.top, width: WIDTH }}
            className="pointer-events-none fixed z-[60] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              <EntityMark name={client.name} />
              <span className="truncate text-[13px] font-medium text-fg">
                {client.name}
              </span>
            </div>

            <div className="p-1">
              <div className="h-px bg-border" />
            </div>

            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
              <span className="text-[13px] text-fg-3">Status</span>
              <Badge
                label={status.label}
                bg={status.badgeBg}
                fg={status.badgeFg}
                size="md"
              />
            </div>

            <CardRow label="Empresa" value={client.name} />
            <CardRow label="Cidade" value={client.city} />
            <CardRow label="E-mail" value={client.email} />
            <CardRow label="Telefone" value={client.phone} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Rótulo à esquerda, valor à direita — traço quando o campo está vazio. */
function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
      <span className="shrink-0 text-[13px] text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-[13px] text-fg-3">
        {value.trim() || "—"}
      </span>
    </div>
  );
}
