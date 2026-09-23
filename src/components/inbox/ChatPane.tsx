"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ArrowLeftIcon,
  BellOffIcon,
  EllipsisIcon,
  PhoneIcon,
  PinIcon,
  ScreenShareIcon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons";
import { PRESENCE_BY_ID } from "@/lib/inbox/constants";
import type { ConversationDetail, InboxMember, Message } from "@/lib/inbox/types";
import { groupByDay, initialsOf, memberName, searchMessages } from "@/lib/inbox/view";
import type { OutgoingExtra } from "./api";
import { Composer } from "./Composer";
import { MemberMenuPanel } from "./MemberMenu";
import { MessageRow } from "./MessageRow";
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
  blobUploads,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onError,
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
  /** O Blob está configurado: anexo sobe direto do navegador (acima de 4,5 MB). */
  blobUploads: boolean;
  onSend: (text: string, extra: OutgoingExtra) => void;
  onEditMessage: (message: Message, text: string) => Promise<void>;
  onDeleteMessage: (message: Message) => void;
  onError: (message: string) => void;
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
  /** A mensagem sendo respondida — a faixa "Respondendo a…" do campo. */
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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

  // Outra conversa, outra resposta.
  useEffect(() => setReplyTo(null), [detail.id]);

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
       *
       * Diz **quem está dentro** (os avatares acesos, com o selo "ao vivo")
       * e, no grupo, quem ainda está fora — "chamada em andamento" sozinho
       * não respondia se valia a pena entrar.
       */}
      {detail.callMemberIds.length > 0 && (
        <CallBanner detail={detail} me={me} emChamada={emChamada} onJoin={() => onStartCall(false)} />
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
              <MessageRow
                key={message.id}
                message={message}
                previous={day.messages[i - 1]}
                messages={detail.messages}
                members={detail.members}
                me={me}
                query={query}
                onReply={setReplyTo}
                onEdit={onEditMessage}
                onDelete={(m) => {
                  if (replyTo?.id === m.id) setReplyTo(null);
                  onDeleteMessage(m);
                }}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        detail={detail}
        meId={me.id}
        sending={sending}
        blobUploads={blobUploads}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(text, extra) => {
          setReplyTo(null);
          onSend(text, extra);
        }}
        onUndesigned={onUndesigned}
        onError={onError}
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

/**
 * A faixa da chamada em curso, embaixo do cabeçalho: selo "ao vivo", quem
 * está dentro (avatares acesos) e, no grupo, quantos ainda estão fora. Quem
 * não está nela vê "Entrar"; quem está em outra aba, "Trazer para esta aba";
 * quem já está nela aqui, só a confirmação.
 */
function CallBanner({
  detail,
  me,
  emChamada,
  onJoin,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  emChamada: boolean;
  onJoin: () => void;
}) {
  const inside = detail.callMemberIds;
  const names = inside.map((id) => (id === me.id ? "Você" : memberName(detail.members, id)));
  const outside = detail.members.filter((m) => !inside.includes(m.id));
  const meInside = inside.includes(me.id);
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-panel-ring bg-surface-2/60 px-4 py-2.5 md:px-5">
      <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-border px-2 py-0.5 text-[10px] font-semibold tracking-[0.4px] text-fg-soft">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-presence-on opacity-60 motion-reduce:hidden" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-presence-on" />
        </span>
        AO VIVO
      </span>
      <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
        {inside.slice(0, 4).map((id) => (
          <span
            key={id}
            className="flex h-6 w-6 items-center justify-center rounded-pill bg-border-strong text-[9px] font-semibold text-fg outline-2 outline-surface-2"
          >
            {initialsOf(id === me.id ? me.name : memberName(detail.members, id))}
          </span>
        ))}
      </span>
      <p className="min-w-0 flex-1 truncate text-[12px] text-fg-3">
        <span className="font-medium text-fg-soft">
          {inside.length === 1 ? "Na chamada: " : `${inside.length} na chamada: `}
        </span>
        {names.join(", ")}
        {detail.kind === "grupo" && outside.length > 0 && (
          <span className="text-muted"> · {outside.length} fora</span>
        )}
      </p>
      {emChamada ? (
        <span className="shrink-0 text-[12px] text-muted">Você está nela</span>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          className="tap shrink-0 rounded-chip bg-primary px-3 py-1 text-[12px] font-medium text-on-primary transition-colors hover:bg-white"
        >
          {/* Você já está nela, em outra aba ou aparelho: entrar daqui a traz para cá. */}
          {meInside ? "Trazer para esta aba" : "Entrar"}
        </button>
      )}
    </div>
  );
}
