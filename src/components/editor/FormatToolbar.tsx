"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  MessageCircleIcon,
  QuoteIcon,
  RemoveFormattingIcon,
  SendIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "@/components/icons";
import type { BlockKind } from "@/lib/editor/markdown";

/*
 * Menu de formatação — aparece com o texto selecionado (export
 * "menu_formatacao"): barra de 44px com o nível do título à esquerda, as
 * marcas no meio e duplicar/enviar no fim.
 *
 * Passar o ponteiro sobre o controle de título abre a lista de níveis (export
 * "formatacao_hover"), com os atalhos à direita, como nos comandos.
 *
 * Nenhum botão daqui tira o foco do texto (`onMouseDown` cancelado): se o
 * `textarea` perdesse o foco, a seleção que se está formatando desapareceria
 * junto — e a descrição salvaria no blur no meio do caminho.
 */

export type ToolbarAt = { left: number; top: number };

const HEADINGS: { kind: BlockKind; label: string; short: string; shortcut: string }[] = [
  { kind: "h1", label: "Heading 1", short: "H1", shortcut: "Ctrl Alt 1" },
  { kind: "h2", label: "Heading 2", short: "H2", shortcut: "Ctrl Alt 2" },
  { kind: "h3", label: "Heading 3", short: "H3", shortcut: "Ctrl Alt 3" },
];

export function FormatToolbar({
  at,
  block,
  onBlock,
  onInline,
  onLink,
  onQuote,
  onClear,
  onCodeBlock,
  onComment,
  onBulletList,
  onDuplicate,
  onSend,
}: {
  at: ToolbarAt;
  /** O bloco da linha do cursor — decide o rótulo do controle de título. */
  block: BlockKind;
  onBlock: (kind: BlockKind) => void;
  onInline: (mark: "bold" | "italic" | "strike" | "underline") => void;
  onLink: () => void;
  onQuote: () => void;
  onClear: () => void;
  onCodeBlock: () => void;
  /** Comentar o trecho selecionado; ausente, o botão não aparece. */
  onComment?: () => void;
  onBulletList: () => void;
  onDuplicate: () => void;
  onSend: () => void;
}) {
  const [headings, setHeadings] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openHeadings() {
    if (closing.current) clearTimeout(closing.current);
    setHeadings(true);
  }

  /** Um respiro para o ponteiro atravessar o vão entre a barra e a lista. */
  function closeHeadings() {
    if (closing.current) clearTimeout(closing.current);
    closing.current = setTimeout(() => setHeadings(false), 120);
  }

  const current = HEADINGS.find((h) => h.kind === block);

  return (
    <div
      style={{ left: at.left, top: at.top }}
      className="fixed z-[70] flex h-11 animate-pop-in items-center gap-1 rounded-[12px] border border-border-soft bg-overlay px-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)]"
    >
      <div
        className="relative"
        onPointerEnter={openHeadings}
        onPointerLeave={closeHeadings}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={headings}
          aria-label="Nível do título"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (headings ? setHeadings(false) : openHeadings())}
          className="flex items-center gap-1 rounded-mark px-2 py-1.5 text-[13px] font-semibold text-fg-2 transition-colors hover:bg-border"
        >
          {current?.short ?? "Aa"}
          <ChevronDownIcon size={13} className="text-muted" />
        </button>

        {headings && (
          <div
            role="menu"
            aria-label="Nível do título"
            className="absolute left-0 top-[calc(100%+8px)] z-[71] w-[264px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          >
            {HEADINGS.map((h) => (
              <button
                key={h.kind}
                type="button"
                role="menuitemradio"
                aria-checked={block === h.kind}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setHeadings(false);
                  onBlock(h.kind);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-mark px-2.5 py-1.5 text-left transition-colors hover:bg-border",
                  block === h.kind && "bg-border",
                )}
              >
                <span className="text-[13px] text-fg-soft">{h.label}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {h.shortcut}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      <ToolButton label="Negrito" onClick={() => onInline("bold")}>
        <BoldIcon size={16} />
      </ToolButton>
      <ToolButton label="Itálico" onClick={() => onInline("italic")}>
        <ItalicIcon size={16} />
      </ToolButton>
      <ToolButton label="Riscado" onClick={() => onInline("strike")}>
        <StrikethroughIcon size={16} />
      </ToolButton>
      <ToolButton label="Sublinhado" onClick={() => onInline("underline")}>
        <UnderlineIcon size={16} />
      </ToolButton>
      <ToolButton label="Link" onClick={onLink}>
        <LinkIcon size={16} />
      </ToolButton>
      <ToolButton label="Citação" onClick={onQuote}>
        <QuoteIcon size={16} />
      </ToolButton>
      <ToolButton label="Limpar formatação" onClick={onClear}>
        <RemoveFormattingIcon size={16} />
      </ToolButton>
      <ToolButton label="Bloco de código" onClick={onCodeBlock}>
        <CodeIcon size={16} />
      </ToolButton>
      {onComment && (
        <ToolButton label="Comentar o trecho" onClick={onComment}>
          <MessageCircleIcon size={16} />
        </ToolButton>
      )}
      <ToolButton label="Lista" onClick={onBulletList}>
        <ListIcon size={16} />
      </ToolButton>

      <Divider />

      <ToolButton label="Duplicar" onClick={onDuplicate}>
        <CopyIcon size={16} />
      </ToolButton>
      <ToolButton label="Salvar agora" onClick={onSend}>
        <SendIcon size={16} />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-mark text-fg-2 transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-soft" />;
}
