"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { ChevronRightIcon, XIcon } from "@/components/icons";

/*
 * A moldura dos modais do produto — a mesma do "Nova tarefa" (export da
 * tarefa, `tasks/TaskModal`): painel de 660px com raio de card, trilha
 * "b · black berry › Título" no topo, corpo com o campo principal em 20px,
 * a tira de chips dos campos, régua e o rodapé com o botão à direita.
 *
 * Modal novo usa esta moldura em vez de montar outra ao lado: era assim que
 * os modais de usuário, domínio, planejamento e lote salvo tinham nascido
 * cada um com uma cara.
 */

export const modalChip =
  "tap flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] inset-ring-1 transition-colors";

/** Chip de escolha: ligado em `border-strong`, desligado discreto. */
export function chipState(on: boolean): string {
  return on
    ? "bg-surface-2 text-fg-soft inset-ring-border-strong"
    : "text-muted inset-ring-border hover:text-fg-soft";
}

export const modalPrimary =
  "tap rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export const modalGhost =
  "tap rounded-field px-4 py-2.5 text-[14px] font-medium text-fg-3 transition-colors hover:text-fg-soft";

/** O campo principal do corpo (o "Título da tarefa"). */
export const modalTitleInput =
  "w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-muted focus:outline-none";

/** O texto de apoio do corpo (a "descrição"). */
export const modalBodyInput =
  "w-full resize-none bg-transparent text-[14px] leading-[21px] text-fg-soft placeholder:text-muted focus:outline-none";

export function ModalShell({
  trail = [],
  title,
  label,
  onClose,
  onSubmit,
  chips,
  footerStart,
  footerEnd,
  className,
  children,
}: {
  /** O que vem antes do título na trilha ("black berry" entra sempre). */
  trail?: string[];
  title: string;
  /** Rótulo para leitor de tela; sem ele, o título. */
  label?: string;
  onClose: () => void;
  /** Com `onSubmit`, a moldura é um `<form>` e o Enter envia. */
  onSubmit?: () => void;
  /** A tira de chips dos campos, abaixo do corpo. */
  chips?: React.ReactNode;
  /** Rodapé: à esquerda (ícone, link, dica) e à direita (as ações). */
  footerStart?: React.ReactNode;
  footerEnd?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Frame = onSubmit ? "form" : "div";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-[2px]" onClick={onClose} />

      <Frame
        {...(onSubmit
          ? {
              onSubmit: (e: React.FormEvent) => {
                e.preventDefault();
                onSubmit();
              },
            }
          : {})}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-[660px] animate-scale-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
          className,
        )}
      >
        {/* Trilha + fechar */}
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-mark bg-dim text-[11px] font-bold text-fg">
              b
            </span>
            {["black berry", ...trail].map((t, i) => (
              <span key={i} className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[14px] text-dim">{t}</span>
                <ChevronRightIcon size={16} className="shrink-0 text-dim" />
              </span>
            ))}
            <span className="shrink-0 text-[14px] font-semibold text-fg-soft">{title}</span>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            title="Fechar"
            onClick={onClose}
            className="tap flex shrink-0 items-center justify-center rounded-full p-2.5 text-muted transition-colors hover:bg-border hover:text-fg-soft"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5 pt-1">{children}</div>

        {chips && <div className="flex flex-wrap items-center gap-2 px-5 pb-5">{chips}</div>}

        {(footerStart || footerEnd) && (
          <>
            <div className="h-px w-full shrink-0 bg-border" />
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">{footerStart}</div>
              <div className="flex shrink-0 items-center gap-2">{footerEnd}</div>
            </div>
          </>
        )}
      </Frame>
    </div>
  );
}
