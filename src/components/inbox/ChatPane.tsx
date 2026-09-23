"use client";

import { MentionText, useMentionInput } from "@/components/team/Mentions";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  BellOffIcon,
  EllipsisIcon,
  PaperclipIcon,
  PhoneIcon,
  PinIcon,
  ScreenShareIcon,
  SearchIcon,
  SmileIcon,
  StickerIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons";
import { PRESENCE_BY_ID } from "@/lib/inbox/constants";
import type { ConversationDetail, InboxMember, Message } from "@/lib/inbox/types";
import {
  groupByDay,
  initialsOf,
  memberName,
  messageTime,
  searchMessages,
  startsBlock,
} from "@/lib/inbox/view";
import { MemberMenuPanel } from "./MemberMenu";
import { PresenceBadge, PresenceDot } from "./PresenceDot";

/*
 * A conversa aberta — cabeçalho, histórico e o campo de escrever, na mesma
 * tela, como o desenho pede. A chamada também mora aqui: ela é uma ação de
 * dentro da conversa (os dois botões do cabeçalho), não outro lugar.
 *
 * O que o cabeçalho ainda não faz, ele diz: fixar mensagem e chamar alguém
 * para o grupo não têm desenho, e avisar é melhor do que inventar a tela (ver
 * `FLUXO.md`).
 */

export function ChatPane({
  detail,
  me,
  sending,
  emChamada,
  onSend,
  onStartCall,
  onToggleMuted,
  onMarkUnread,
  onBack,
  onUndesigned,
  team,
  onAddPerson,
  className,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  sending: boolean;
  /** Você já está na chamada — então não se oferece "entrar" de novo. */
  emChamada: boolean;
  onSend: (text: string) => void;
  onStartCall: (withScreen: boolean) => void;
  onToggleMuted: () => void;
  onMarkUnread: () => void;
  /** Só no celular: volta para a lista. */
  onBack: () => void;
  onUndesigned: (what: string) => void;
  /** A equipe da agência, com a presença de agora — de onde sai o "adicionar". */
  team: InboxMember[];
  /** Direta: cria um grupo com quem já estava e a pessoa nova. Grupo: adiciona. */
  onAddPerson: (memberId: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const last = detail.messages[detail.messages.length - 1];

  // Chegou mensagem (ou trocou a conversa): o fim da conversa é o que importa.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detail.id, last?.id]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
    else setQuery("");
  }, [searching]);

  const shown = searchMessages(detail.messages, query);
  const days = groupByDay(shown);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-ring px-4 py-3 md:px-5 md:py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para as conversas"
            className="tap -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-chip text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft md:hidden"
          >
            <ArrowLeftIcon size={16} />
          </button>

          <span className="relative h-[34px] w-[34px] shrink-0">
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-pill bg-border text-[12px] font-semibold text-fg-3"
              aria-hidden="true"
            >
              {initialsOf(detail.title)}
            </span>
            {detail.presence && (
              <PresenceBadge presence={detail.presence} ring="bg-surface" />
            )}
          </span>

          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="truncate text-[15px] font-semibold text-fg">
              {detail.title}
            </h2>
            <div className="flex items-center gap-1.5">
              {detail.onlineCount < 0 ? (
                // Presença ainda carregando (tempo real conectando): sem chute.
                detail.kind === "grupo" && (
                  <span className="truncate text-[12px] text-muted">
                    {detail.memberCount} {detail.memberCount === 1 ? "membro" : "membros"}
                  </span>
                )
              ) : detail.kind === "direta" && detail.presence ? (
                <>
                  <PresenceDot presence={detail.presence} size={7} />
                  <span className="truncate text-[12px] text-muted">
                    {PRESENCE_BY_ID[detail.presence].label}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      detail.onlineCount > 0 ? "bg-presence-on" : "bg-presence-off",
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[12px] text-muted">
                    {detail.onlineCount} online · {detail.memberCount}{" "}
                    {detail.memberCount === 1 ? "membro" : "membros"}
                  </span>
                </>
              )}
              {detail.muted && (
                <BellOffIcon size={11} className="shrink-0 text-muted" />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 md:gap-1.5">
          <HeaderButton label="Chamada de voz" onClick={() => onStartCall(false)}>
            <PhoneIcon size={15} />
          </HeaderButton>
          {/*
           * O export desenha uma câmera aqui. A decisão do produto é chamada
           * de voz + tela compartilhada, sem vídeo (issue #30) — então o
           * ícone é o da tela: câmera que nunca abre câmera é promessa falsa.
           */}
          <HeaderButton
            label="Chamada com tela compartilhada"
            onClick={() => onStartCall(true)}
          >
            <ScreenShareIcon size={15} />
          </HeaderButton>
          <HeaderButton
            label="Fixar mensagem"
            className="hidden sm:flex"
            onClick={() => onUndesigned("Fixar mensagem")}
          >
            <PinIcon size={15} />
          </HeaderButton>
          <AddPerson
            detail={detail}
            me={me}
            team={team}
            open={adding}
            onOpenChange={setAdding}
            onSelect={(id) => {
              setAdding(false);
              onAddPerson(id);
            }}
          />
          <HeaderButton
            label="Buscar na conversa"
            pressed={searching}
            onClick={() => setSearching((s) => !s)}
          >
            <SearchIcon size={15} />
          </HeaderButton>
          <ChatMenu
            muted={detail.muted}
            onAddPerson={() => setAdding(true)}
            onToggleMuted={onToggleMuted}
            onMarkUnread={onMarkUnread}
          />
        </div>
      </header>

      {searching && (
        <div className="flex shrink-0 items-center gap-2 border-b border-panel-ring bg-surface-2/60 px-4 py-2 md:px-5">
          <SearchIcon size={13} className="shrink-0 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearching(false)}
            placeholder="Buscar nesta conversa"
            aria-label="Buscar nesta conversa"
            className="w-full bg-transparent text-[12px] text-fg-soft outline-none placeholder:text-muted"
          />
          <span className="shrink-0 text-[11px] text-muted">
            {query ? `${shown.length} de ${detail.messages.length}` : `${detail.messages.length} mensagens`}
          </span>
          <button
            type="button"
            onClick={() => setSearching(false)}
            aria-label="Fechar a busca"
            className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}

      {/*
       * Chamada acontecendo agora. Não estava no export — é o que faz a
       * chamada existir para quem não estava com a tela aberta no segundo
       * em que ela começou, e some sozinha quando o último sai.
       */}
      {detail.callMemberIds.length > 0 && !emChamada && (
        <div className="flex shrink-0 items-center gap-3 border-b border-panel-ring bg-surface-2/60 px-4 py-2.5 md:px-5">
          <PhoneIcon size={14} className="shrink-0 text-fg-3" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-fg-3">
            Chamada em andamento ·{" "}
            {detail.callMemberIds
              .map((id) => (id === me.id ? "Você" : memberName(detail.members, id)))
              .join(", ")}
          </p>
          <button
            type="button"
            onClick={() => onStartCall(false)}
            className="tap shrink-0 rounded-chip bg-primary px-3 py-1 text-[12px] font-medium text-on-primary transition-colors hover:bg-white"
          >
            {/* Você já está nela, em outra aba ou aparelho: entrar daqui a traz para cá. */}
            {detail.callMemberIds.includes(me.id) ? "Trazer para esta aba" : "Entrar"}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 md:px-6">
        {shown.length === 0 && (
          <p className="m-auto max-w-[260px] text-center text-[12px] leading-[18px] text-muted">
            {query
              ? "Nada encontrado nesta conversa."
              : "Nenhuma mensagem ainda. Diga a primeira coisa."}
          </p>
        )}

        {days.map((day) => (
          <div key={day.key} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.6px] text-muted">
                {day.label}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {day.messages.map((message, i) => (
              <Row
                key={message.id}
                message={message}
                previous={day.messages[i - 1]}
                members={detail.members}
                me={me}
                query={query}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        title={detail.title}
        kind={detail.kind}
        sending={sending}
        onSend={onSend}
        onUndesigned={onUndesigned}
      />
    </div>
  );
}

function HeaderButton({
  label,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "tap flex h-[30px] w-[30px] items-center justify-center rounded-chip transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        pressed
          ? "bg-border text-fg-soft"
          : "text-fg-3 hover:bg-surface-2 hover:text-fg-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** O "⋯" do cabeçalho: o que é de quem está olhando, e só dele. */
/**
 * O "adicionar alguém" do cabeçalho. Numa direta, escolher alguém cria um
 * grupo com as três pessoas — a direta continua lá, com o histórico de duas
 * pessoas intacto, como no Slack e no Discord. Num grupo, a pessoa entra no
 * grupo e o aviso fica na conversa.
 *
 * No celular o botão some do cabeçalho (não cabe) e o mesmo painel abre pelo
 * "Adicionar alguém" do menu "…".
 */
function AddPerson({
  detail,
  me,
  team,
  open,
  onOpenChange,
  onSelect,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  team: InboxMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (memberId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inside = new Set(detail.members.map((m) => m.id));
  const candidates = team.filter((m) => m.id !== me.id && !inside.has(m.id));
  const other = detail.members.find((m) => m.id !== me.id);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      <HeaderButton
        label={detail.kind === "direta" ? "Criar grupo com mais alguém" : "Adicionar alguém ao grupo"}
        className="hidden sm:flex"
        pressed={open}
        onClick={() => onOpenChange(!open)}
      >
        <UserPlusIcon size={15} />
      </HeaderButton>
      {open && (
        <MemberMenuPanel
          members={candidates}
          heading={
            detail.kind === "direta"
              ? `Criar um grupo com ${other?.name ?? "esta pessoa"} e…`
              : "Adicionar ao grupo"
          }
          emptyText={
            detail.kind === "direta"
              ? "Não há mais ninguém na agência para chamar."
              : "Todo mundo da agência já está neste grupo."
          }
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function ChatMenu({
  muted,
  onAddPerson,
  onToggleMuted,
  onMarkUnread,
}: {
  muted: boolean;
  onAddPerson: () => void;
  onToggleMuted: () => void;
  onMarkUnread: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <HeaderButton
        label="Mais ações da conversa"
        pressed={open}
        onClick={() => setOpen((o) => !o)}
      >
        <EllipsisIcon size={15} />
      </HeaderButton>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[210px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {/* No celular o botão do cabeçalho não cabe: o caminho é este. */}
          <MenuItem
            className="sm:hidden"
            onSelect={() => {
              setOpen(false);
              onAddPerson();
            }}
          >
            Adicionar alguém
          </MenuItem>
          <MenuItem
            onSelect={() => {
              setOpen(false);
              onToggleMuted();
            }}
          >
            {muted ? "Ativar notificações" : "Silenciar conversa"}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              setOpen(false);
              onMarkUnread();
            }}
          >
            Marcar como não lida
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onSelect,
  className,
  children,
}: {
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-border",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Row({
  message,
  previous,
  members,
  me,
  query,
}: {
  message: Message;
  previous?: Message;
  members: InboxMember[];
  me: InboxMember;
  /** Enquanto a busca está aberta, todo bloco abre: o vizinho pode ter sumido. */
  query: string;
}) {
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

  const author = message.authorId === me.id ? "Você" : memberName(members, message.authorId);
  const opens = !!query || startsBlock(message, previous);

  if (!opens) {
    return (
      <p className="-mt-3 pl-[46px] text-[13px] leading-[18px] text-fg-soft [overflow-wrap:anywhere] whitespace-pre-wrap">
        <Highlight text={message.text} query={query} />
      </p>
    );
  }

  return (
    <div className="flex w-full items-start gap-3">
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill bg-border text-[12px] font-semibold text-fg-3"
        aria-hidden="true"
      >
        {initialsOf(author === "Você" ? me.name : author)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{author}</span>
          <span className="text-[11px] text-muted">
            {messageTime(message.createdAt)}
          </span>
        </div>
        <p className="text-[13px] leading-[18px] text-fg-soft [overflow-wrap:anywhere] whitespace-pre-wrap">
          <Highlight text={message.text} query={query} />
        </p>
      </div>
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

function Composer({
  title,
  kind,
  sending,
  onSend,
  onUndesigned,
}: {
  title: string;
  kind: ConversationDetail["kind"];
  sending: boolean;
  onSend: (text: string) => void;
  onUndesigned: (what: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const mentions = useMentionInput({
    value: draft,
    onChange: (v) => {
      setDraft(v);
      requestAnimationFrame(grow);
    },
    field: ref,
  });

  function grow() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    onSend(text);
    setDraft("");
    requestAnimationFrame(grow);
  }

  return (
    <div className="shrink-0 px-4 pb-4 pt-3 md:px-5 md:pb-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2.5 rounded-nav border border-panel-ring bg-surface-2 px-3 py-2.5"
      >
        <ComposerIcon
          label="Anexar arquivo"
          onClick={() => onUndesigned("Anexo na conversa")}
        >
          <PaperclipIcon size={16} />
        </ComposerIcon>

        <textarea
          ref={ref}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            grow();
          }}
          {...mentions.inputProps}
          onKeyDown={(e) => {
            // Com o menu de @ aberto, Enter escolhe a pessoa — não envia.
            if (mentions.onKeyDown(e)) return;
            // Enter manda; Shift+Enter quebra a linha, como em toda conversa.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Mensagem em ${kind === "grupo" ? "#" : ""}${title}`}
          aria-label={`Mensagem em ${title}`}
          className="max-h-[120px] min-h-[20px] flex-1 resize-none bg-transparent py-[3px] text-[13px] leading-[18px] text-fg-soft outline-none placeholder:text-muted"
        />

        <ComposerIcon
          label="Emoji"
          onClick={() => onUndesigned("Seletor de emoji")}
        >
          <SmileIcon size={16} />
        </ComposerIcon>
        <ComposerIcon
          label="GIF"
          onClick={() => onUndesigned("Biblioteca de GIFs")}
        >
          <StickerIcon size={16} />
        </ComposerIcon>

        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Enviar mensagem"
          title="Enviar mensagem"
          className={cn(
            "tap flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-primary text-on-primary transition-opacity",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3",
            (!draft.trim() || sending) && "opacity-40",
          )}
        >
          <ArrowUpIcon size={14} />
        </button>
        {mentions.menu()}
      </form>
    </div>
  );
}

function ComposerIcon({
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
      className="tap flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-fg-3 transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}
