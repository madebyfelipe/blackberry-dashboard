"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  CalendarIcon,
  ChevronRightIcon,
  Maximize2Icon,
  XIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export type NewBatchValues = {
  title: string;
  period: string;
  description: string;
};

/**
 * "Novo lote" — export "Lotes de Aprovação ADD7".
 *
 * Mesma caixa do "New Issue Modal" das Tarefas (é o que o export mostra:
 * mesma moldura, mesma trilha no topo, mesma fileira de chips, mesmo rodapé),
 * com os campos que um lote tem de verdade: título, período e descrição. O
 * cliente não é campo — vem da tela de onde o modal abriu.
 *
 * Prioridade e etiquetas do export ficaram de fora: são propriedades de
 * tarefa, e gravá-las no lote inventaria dado que nenhuma tela lê.
 */
export function NewBatchModal({
  client,
  open,
  onClose,
  onSubmit,
  saving,
}: {
  client: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: NewBatchValues) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLInputElement>(null);

  // Cada abertura começa em branco — senão o lote anterior volta no campo.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPeriod("");
    setDescription("");
    setPeriodOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (periodOpen) periodRef.current?.focus();
  }, [periodOpen]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    onSubmit({ title, period, description });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`Novo lote para ${client}`}
        className="relative flex max-h-[90vh] w-full max-w-[660px] animate-scale-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] text-dim">{client}</span>
            <ChevronRightIcon size={16} className="shrink-0 text-dim" />
            <span className="shrink-0 text-[14px] font-semibold text-fg-soft">
              Novo lote
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <IconGhost
              label="Expandir"
              onClick={() => toast("A tela cheia do lote chega com o editor.", "info")}
            >
              <Maximize2Icon size={16} />
            </IconGhost>
            <IconGhost label="Fechar" onClick={onClose}>
              <XIcon size={16} />
            </IconGhost>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do lote"
            className="w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-muted focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicionar descrição..."
            rows={2}
            className="w-full resize-none bg-transparent text-[14px] text-fg-soft placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* Field toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          {/*
           * O lote nasce rascunho: quem o envia ao cliente é o "Enviar para
           * aprovação" do editor. O selo diz o estado, não oferece escolha.
           */}
          <span className="flex h-8 items-center gap-1.5 rounded-pill bg-surface px-2.5 text-[12px] text-fg-soft inset-ring-1 inset-ring-border">
            <span className="h-[7px] w-[7px] rounded-full bg-badge-strong" />
            Rascunho
          </span>

          {periodOpen ? (
            <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
              <span className="text-muted">
                <CalendarIcon size={14} />
              </span>
              <input
                ref={periodRef}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                onBlur={() => !period.trim() && setPeriodOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setPeriodOpen(false);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setPeriod("");
                    setPeriodOpen(false);
                  }
                }}
                placeholder="01-30 set"
                size={10}
                className="bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPeriodOpen(true)}
              className={cn(
                "tap flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] inset-ring-1 transition-colors",
                period.trim()
                  ? "text-fg-soft inset-ring-border-strong"
                  : "text-fg-3 inset-ring-border hover:bg-border",
              )}
            >
              <span className="text-muted">
                <CalendarIcon size={14} />
              </span>
              {period.trim() || "Período"}
            </button>
          )}
        </div>

        <div className="h-px w-full bg-border" />

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="tap rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Criando…
              </span>
            ) : (
              "Criar lote"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function IconGhost({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="tap flex items-center justify-center rounded-full p-2.5 text-muted transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}
