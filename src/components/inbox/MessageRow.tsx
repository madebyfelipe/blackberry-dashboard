"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MentionText } from "@/components/team/Mentions";
import { anchorMenu, useCloseOnScroll, type MenuPosition } from "@/components/ui/anchoredMenu";
import { cn } from "@/lib/cn";
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FileIcon,
  PencilIcon,
  PhoneIcon,
  PinIcon,
  ReplyIcon,
  TrashIcon,
} from "@/components/icons";
import { MESSAGE_EDIT_WINDOW_MS, canChangeMessage } from "@/lib/inbox/constants";
import type { Attachment, InboxMember, Message } from "@/lib/inbox/types";
import { initialsOf, memberName, messageText, messageTime, startsBlock } from "@/lib/inbox/view";
import { formatBytes } from "@/lib/media/constants";

/*
 * Uma mensagem da conversa, com o que dá para fazer com ela.
 *
 * No hover (ou foco) aparecem, à direita, "responder" e o "⋯": responder,
 * copiar e — na sua própria mensagem, até 10 minutos depois de enviada —
 * editar e apagar. A regra dos 10 minutos é do repositório
 * (`canChangeMessage`); a tela só esconde o que o servidor recusaria.
 *
 * A resposta mostra, acima do texto, quem e o quê está sendo respondido;
 * clicar nela leva até a mensagem original.
 */

export function MessageRow({
  message,
  previous,
  messages,
  members,
  me,
  query,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message;
  previous?: Message;
  /** A conversa inteira — é daqui que sai a mensagem respondida. */
  messages: Message[];
  members: InboxMember[];
  me: InboxMember;
  /** Enquanto a busca está aberta, todo bloco abre: o vizinho pode ter sumido. */
  query: string;
  onReply: (message: Message) => void;
  onEdit: (message: Message, text: string) => Promise<void>;
  onDelete: (message: Message) => void;
}) {
  const [editing, setEditing] = useState(false);

  // Linha de sistema: ícone e frase em cinza, alinhados com o texto das falas.
  if (message.kind !== "texto") {
    return (
      <div className="flex items-center gap-3 py-0.5 pl-0 md:pl-[46px]">
        {message.kind === "chamada" ? (
          <PhoneIcon size={13} className="shrink-0 text-muted" />
        ) : (
          <PinIcon size={13} className="shrink-0 text-muted" />
        )}
        <p className="text-[12px] text-muted">{message.text}</p>
      </div>
    );
  }

  const mine = message.authorId === me.id;
  const author = mine ? "Você" : memberName(members, message.authorId);
  const opens = !!query || startsBlock(message, previous) || !!message.replyToId;
  const pending = message.id.startsWith("pendente-");
  const reply = message.replyToId ? messages.find((m) => m.id === message.replyToId) : undefined;

  const body = (
    <>
      {message.replyToId && (
        <ReplyQuote
          original={reply}
          name={reply ? (reply.authorId === me.id ? "Você" : memberName(members, reply.authorId)) : ""}
        />
      )}
      {editing ? (
        <EditBox
          initial={message.text}
          onCancel={() => setEditing(false)}
          onSave={async (text) => {
            await onEdit(message, text);
            setEditing(false);
          }}
        />
      ) : message.deletedAt ? (
        <p className="text-[13px] italic leading-[18px] text-muted">Mensagem apagada</p>
      ) : (
        message.text && (
          <p className="text-[13px] leading-[18px] text-fg-soft [overflow-wrap:anywhere] whitespace-pre-wrap">
            <Highlight text={message.text} query={query} />
            {message.editedAt && !opens && <EditedMark />}
          </p>
        )
      )}
      {!message.deletedAt && message.attachments.length > 0 && (
        <Attachments items={message.attachments} />
      )}
    </>
  );

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "group relative -mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-chip px-2 transition-colors",
        "hover:bg-surface-2/50 focus-within:bg-surface-2/50",
        opens ? "py-1" : "-mt-3 py-0.5",
        pending && "opacity-60",
      )}
    >
      {opens ? (
        <span
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill bg-border text-[12px] font-semibold text-fg-3"
          aria-hidden="true"
        >
          {initialsOf(mine ? me.name : author)}
        </span>
      ) : (
        <span className="w-[34px] shrink-0" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {opens && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-fg">{author}</span>
            <span className="text-[11px] text-muted">{messageTime(message.createdAt)}</span>
            {message.editedAt && !message.deletedAt && <EditedMark />}
          </div>
        )}
        {body}
      </div>

      {!pending && !message.deletedAt && !editing && (
        <RowActions
          message={message}
          meId={me.id}
          onReply={() => onReply(message)}
          onEdit={() => setEditing(true)}
          onDelete={() => onDelete(message)}
        />
      )}
    </div>
  );
}

function EditedMark() {
  return <span className="ml-1 text-[11px] text-muted">(editada)</span>;
}

/** "Respondendo a…" acima do texto; o clique leva até a original e a acende. */
function ReplyQuote({ original, name }: { original?: Message; name: string }) {
  return (
    <button
      type="button"
      disabled={!original}
      onClick={() => {
        if (!original) return;
        const el = document.getElementById(`msg-${original.id}`);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("bg-surface-2");
        setTimeout(() => el.classList.remove("bg-surface-2"), 1200);
      }}
      className="flex w-fit max-w-full items-center gap-1.5 rounded-mark border-l-2 border-border-strong bg-surface-2/70 py-1 pl-2 pr-2.5 text-left text-[12px] text-muted transition-colors enabled:hover:text-fg-3"
    >
      <ReplyIcon size={12} className="shrink-0" />
      {original ? (
        <span className="min-w-0 truncate">
          <span className="font-semibold text-fg-3">{name}</span> · {messageText(original)}
        </span>
      ) : (
        <span className="truncate italic">Mensagem que não está mais aqui</span>
      )}
    </button>
  );
}

function RowActions({
  message,
  meId,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message;
  meId: string;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPos(null), []);
  useCloseOnScroll(!!pos, close);

  useEffect(() => {
    if (!pos) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setPos(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPos(null);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  // Aberto o menu, a janela dos 10 minutos é conferida de novo a cada abertura.
  const changeable = canChangeMessage(message, meId);
  const until = new Date(Date.parse(message.createdAt) + MESSAGE_EDIT_WINDOW_MS);
  const untilLabel = `até ${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-chip border border-border bg-surface p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-opacity",
        pos ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
      )}
    >
      <ActionButton label="Responder" onClick={onReply}>
        <ReplyIcon size={14} />
      </ActionButton>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Mais ações da mensagem"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => {
          if (pos) return setPos(null);
          const r = buttonRef.current?.getBoundingClientRect();
          if (r) setPos(anchorMenu(r, { width: 200, height: changeable ? 176 : 92 }));
        }}
        className={cn(
          "tap flex h-7 w-7 items-center justify-center rounded-mark transition-colors",
          pos ? "bg-border text-fg-soft" : "text-fg-3 hover:bg-surface-2 hover:text-fg-soft",
        )}
      >
        <EllipsisIcon size={14} />
      </button>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            className="fixed z-[60] w-[200px] animate-pop-in overflow-y-auto rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          >
            <MenuAction
              icon={<ReplyIcon size={14} />}
              onSelect={() => {
                setPos(null);
                onReply();
              }}
            >
              Responder
            </MenuAction>
            {message.text && (
              <MenuAction
                icon={<CopyIcon size={14} />}
                onSelect={() => {
                  setPos(null);
                  void navigator.clipboard?.writeText(message.text).catch(() => undefined);
                }}
              >
                Copiar texto
              </MenuAction>
            )}
            {changeable && (
              <>
                <div className="p-1">
                  <div className="h-px bg-border" />
                </div>
                {message.text && (
                  <MenuAction
                    icon={<PencilIcon size={14} />}
                    hint={untilLabel}
                    onSelect={() => {
                      setPos(null);
                      onEdit();
                    }}
                  >
                    Editar
                  </MenuAction>
                )}
                <MenuAction
                  danger
                  icon={<TrashIcon size={14} />}
                  hint={untilLabel}
                  onSelect={() => {
                    setPos(null);
                    onDelete();
                  }}
                >
                  Apagar
                </MenuAction>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ActionButton({
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
      onClick={onClick}
      className="tap flex h-7 w-7 items-center justify-center rounded-mark text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft"
    >
      {children}
    </button>
  );
}

function MenuAction({
  icon,
  hint,
  danger,
  onSelect,
  children,
}: {
  icon: React.ReactNode;
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-border",
        danger ? "text-danger" : "text-fg-soft",
      )}
    >
      <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </button>
  );
}

/** A edição no lugar: Enter salva, Esc cancela, Shift+Enter quebra a linha. */
function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  async function save() {
    const text = value.trim();
    if (!text || saving) return;
    if (text === initial.trim()) return onCancel();
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
        aria-label="Editar mensagem"
        className="w-full resize-none rounded-mark border border-panel-ring bg-surface-2 px-2.5 py-1.5 text-[13px] leading-[18px] text-fg-soft outline-none focus:border-border-strong"
      />
      <p className="text-[11px] text-muted">
        Esc para{" "}
        <button type="button" onClick={onCancel} className="text-fg-3 underline-offset-2 hover:underline">
          cancelar
        </button>{" "}
        · Enter para{" "}
        <button type="button" onClick={() => void save()} className="text-fg-3 underline-offset-2 hover:underline">
          {saving ? "salvando…" : "salvar"}
        </button>
      </p>
    </div>
  );
}

/** Imagem e GIF aparecem; vídeo e áudio tocam ali mesmo; documento vira cartão. */
export function Attachments({ items }: { items: Attachment[] }) {
  return (
    <div className="flex flex-wrap gap-2 pt-0.5">
      {items.map((a) => {
        if (a.kind === "imagem" || a.kind === "gif") {
          return (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-chip border border-panel-ring bg-surface-2"
              title={a.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.kind === "gif" ? a.name || "GIF" : a.name}
                loading="lazy"
                width={a.width}
                height={a.height}
                className="block h-auto max-h-[240px] w-auto max-w-[min(320px,100%)] object-contain"
              />
            </a>
          );
        }
        if (a.kind === "video") {
          return (
            <video
              key={a.id}
              src={a.url}
              controls
              preload="metadata"
              className="max-h-[260px] max-w-[min(360px,100%)] rounded-chip border border-panel-ring bg-black"
            />
          );
        }
        if (a.kind === "audio") {
          return (
            <audio
              key={a.id}
              src={a.url}
              controls
              preload="metadata"
              className="h-10 w-[min(300px,100%)]"
              aria-label="Mensagem de voz"
            />
          );
        }
        return (
          <a
            key={a.id}
            href={a.url}
            download={a.name}
            className="flex w-[min(280px,100%)] items-center gap-3 rounded-chip border border-panel-ring bg-surface-2 px-3 py-2.5 transition-colors hover:bg-border"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mark bg-border text-fg-3">
              <FileIcon size={16} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-fg-soft">{a.name}</span>
              <span className="text-[11px] text-muted">{formatBytes(a.size)}</span>
            </span>
            <DownloadIcon size={14} className="shrink-0 text-muted" />
          </a>
        );
      })}
    </div>
  );
}

/** Marca o trecho buscado sem mexer no texto — o realce é do leitor, não do dado. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  // Sem busca, a mensagem mostra as menções do time em destaque.
  if (!q) return <MentionText text={text} />;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return <MentionText text={text} />;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-border px-0.5 text-fg">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}
