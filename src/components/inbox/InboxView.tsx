"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { conversationChannel } from "@/lib/realtime/channels";
import type {
  ConversationDetail,
  ConversationSummary,
  Message,
} from "@/lib/inbox/types";
import { sortSummaries } from "@/lib/inbox/view";
import {
  apiConversation,
  apiInbox,
  apiOpenDirect,
  apiPatchConversation,
  apiSendMessage,
  type InboxSnapshot,
} from "./api";
import { CallOverlay } from "./CallOverlay";
import { ChatPane } from "./ChatPane";
import { ConversationList } from "./ConversationList";

/*
 * A tela do Inbox: a lista de conversas e a conversa aberta, no painel de
 * 28px do design system v3.
 *
 * Uma diferença em relação às outras telas do v3: o painel aqui **não tem
 * respiro interno**. A lista encosta na borda esquerda e a divisória vai de
 * ponta a ponta, como o export desenha — por isso esta tela monta a própria
 * caixa em vez de usar `ui/Screen`, que existe para telas de conteúdo com
 * 28px de margem.
 *
 * Enquanto não existir camada de tempo real (ver `ROADMAP.md`), quem busca o
 * que chegou é o navegador: a tela relê o estado de tempos em tempos, e só
 * com a aba à vista — atualizar uma aba escondida gasta bateria e não muda
 * nada na frente de ninguém.
 */

/*
 * De quanto em quanto tempo a tela relê tudo.
 *
 * Com o tempo real ligado, a releitura deixa de ser o mecanismo e vira rede
 * de segurança: cobre o intervalo entre a conexão cair e voltar, e qualquer
 * evento que se perca no caminho. Sem ele, continua sendo o mecanismo — e aí
 * precisa ser frequente.
 */
const POLL_MS = 12_000;
const POLL_MS_COM_EVENTOS = 60_000;

export function InboxView({
  snapshot,
  initialConversation,
}: {
  snapshot: InboxSnapshot;
  initialConversation: ConversationDetail | null;
}) {
  const { toast } = useToast();
  const { eventos, conectado, online, assinar } = useRealtime();
  const [state, setState] = useState(snapshot);
  const [detail, setDetail] = useState<ConversationDetail | null>(
    initialConversation,
  );
  const [openId, setOpenId] = useState<string | null>(
    initialConversation?.id ?? null,
  );
  /** Celular: a conversa cobre a lista. No desktop as duas convivem. */
  const [showChat, setShowChat] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sending, setSending] = useState(false);
  const [call, setCall] = useState<{ withScreen: boolean } | null>(null);

  const openIdRef = useRef(openId);
  openIdRef.current = openId;
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  /*
   * Presença ao vivo por cima da gravada.
   *
   * O que está no banco é o status que a pessoa escolheu; quem está de fato
   * com o produto aberto é o que a conexão sabe. Com a conexão de pé, quem
   * não está nela é offline — sem depender de alguém ter lembrado de se
   * marcar como tal antes de fechar o navegador.
   *
   * **Com a conexão caída, vale o gravado.** A conexão só sabe de ausência
   * enquanto ela mesma existe: tratar "não sei" como "todo mundo offline"
   * apagaria o time inteiro da tela por um problema que é do navegador de
   * quem está olhando, não deles.
   */
  const aoVivo = useCallback(
    (item: ConversationSummary): ConversationSummary => {
      if (!eventos || !conectado) return item;
      const outro = item.memberIds.find((id) => id !== state.me.id);
      return {
        ...item,
        presence:
          item.kind === "direta" ? (outro ? (online[outro] ?? "offline") : "offline") : null,
        onlineCount: item.memberIds.filter((id) => !!online[id]).length,
      };
    },
    [eventos, conectado, online, state.me.id],
  );

  const conversations = useMemo(
    () => sortSummaries(state.conversations).map(aoVivo),
    [state.conversations, aoVivo],
  );

  const fail = useCallback(
    (err: unknown) =>
      toast(
        err instanceof Error ? err.message : "Algo deu errado. Tente de novo.",
        "error",
      ),
    [toast],
  );

  /** Relê o estado inteiro — a lista e, se houver, a conversa aberta. */
  const refresh = useCallback(async () => {
    try {
      const next = await apiInbox();
      setState(next);
      const id = openIdRef.current;
      // Uma mensagem sendo enviada é mais nova que o servidor: não atropela.
      if (id && !sendingRef.current) {
        const updated = await apiConversation(id);
        setDetail((current) => (current?.id === updated.id ? updated : current));
        /*
         * Chegou coisa nova na conversa que está aberta na tela: ela já foi
         * lida — deixar o badge subir enquanto a pessoa lê seria contar
         * mensagem que ela está vendo.
         */
        if (updated.unread > 0) {
          await apiPatchConversation(id, { read: true });
          setState((s) => ({
            ...s,
            conversations: s.conversations.map((c) =>
              c.id === id ? { ...c, unread: 0 } : c,
            ),
          }));
        }
      }
    } catch {
      // Falha de rede não pode derrubar a conversa que está na tela: a
      // próxima rodada tenta de novo, e o histórico continua lá.
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(
      tick,
      eventos && conectado ? POLL_MS_COM_EVENTOS : POLL_MS,
    );
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, eventos, conectado]);

  /*
   * Ouve as conversas de que você participa. O evento é só um empurrão — quem
   * traz o conteúdo é a mesma API de sempre, então não existe um segundo
   * caminho pelo qual a conversa possa chegar diferente.
   *
   * Reassina quando a lista de conversas muda (uma direta nova, por exemplo),
   * e aí o crachá também precisa ser renovado: a permissão dele lista as
   * conversas que existiam quando foi emitido.
   */
  const idsAssinados = state.conversations.map((c) => c.id).sort().join(",");
  useEffect(() => {
    if (!eventos || !conectado) return;
    const agencyId = state.me.agencyId;
    const cancelar = idsAssinados
      .split(",")
      .filter(Boolean)
      .map((id) =>
        assinar(conversationChannel(agencyId, id), () => {
          void refresh();
        }),
      );
    return () => cancelar.forEach((parar) => parar());
  }, [idsAssinados, eventos, conectado, assinar, state.me.agencyId, refresh]);

  /*
   * No desktop a conversa mais recente já vem aberta (é o que o desenho
   * mostra), então ela nasce lida. No celular a tela começa na lista: marcar
   * ali seria dar por lida uma conversa que ninguém abriu.
   */
  useEffect(() => {
    const id = initialConversation?.id;
    if (!id || !window.matchMedia("(min-width: 768px)").matches) return;
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unread: 0 } : c,
      ),
    }));
    setDetail((d) => (d?.id === id ? { ...d, unread: 0 } : d));
    apiPatchConversation(id, { read: true }).catch(() => undefined);
  }, [initialConversation?.id]);

  function markReadLocally(id: string) {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unread: 0 } : c,
      ),
    }));
  }

  async function open(id: string) {
    setOpenId(id);
    setShowChat(true);
    markReadLocally(id);
    try {
      const [conversation] = await Promise.all([
        apiConversation(id),
        apiPatchConversation(id, { read: true }),
      ]);
      setDetail({ ...conversation, unread: 0 });
    } catch (err) {
      fail(err);
    }
  }

  async function startDirect(memberId: string) {
    try {
      const conversation = await apiOpenDirect(memberId);
      setDetail(conversation);
      setOpenId(conversation.id);
      setShowChat(true);
      await refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function send(text: string) {
    const id = detail?.id;
    if (!id) return;

    /*
     * A mensagem aparece antes da resposta do servidor — conversa em que a
     * própria fala demora a aparecer parece travada. Se a gravação falhar,
     * ela sai da tela e o erro aparece, em vez de ficar uma fala fantasma.
     */
    const pending: Message = {
      id: `pendente-${Date.now()}`,
      authorId: state.me.id,
      text,
      createdAt: new Date().toISOString(),
      kind: "texto",
    };
    setDetail((d) => (d ? { ...d, messages: [...d.messages, pending] } : d));
    setSending(true);
    try {
      const updated = await apiSendMessage(id, text);
      setDetail((d) => (d?.id === updated.id ? updated : d));
      void refresh();
    } catch (err) {
      setDetail((d) =>
        d ? { ...d, messages: d.messages.filter((m) => m.id !== pending.id) } : d,
      );
      fail(err);
    } finally {
      setSending(false);
    }
  }

  /*
   * A chamada fechou. Quem sai por último deixa a linha no histórico, e o
   * servidor devolve a conversa já com ela — por isso a tela aceita a
   * conversa de volta em vez de recarregar tudo às cegas.
   */
  function closeCall(updated?: ConversationDetail) {
    setCall(null);
    if (updated) setDetail((d) => (d?.id === updated.id ? updated : d));
    void refresh();
  }

  async function toggleMuted() {
    if (!detail) return;
    const muted = !detail.muted;
    setDetail({ ...detail, muted });
    try {
      const summary = await apiPatchConversation(detail.id, { muted });
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === summary.id ? summary : c,
        ),
      }));
      toast(muted ? "Conversa silenciada." : "Notificações ativadas.", "info");
    } catch (err) {
      setDetail((d) => (d ? { ...d, muted: !muted } : d));
      fail(err);
    }
  }

  async function markUnread() {
    if (!detail) return;
    const id = detail.id;
    try {
      const summary = await apiPatchConversation(id, { read: false });
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === summary.id ? summary : c,
        ),
      }));
      // Continuar com ela aberta marcaria tudo como lido de novo no instante
      // seguinte; voltar para a lista é o que faz o "não lida" durar.
      setDetail(null);
      setOpenId(null);
      setShowChat(false);
      toast("Marcada como não lida.", "info");
    } catch (err) {
      fail(err);
    }
  }

  const undesigned = (what: string) =>
    toast(`${what} chega com o desenho dela.`, "info");

  return (
    <section className="flex h-full min-h-0 overflow-hidden rounded-screen border border-panel-ring bg-surface">
      <ConversationList
        conversations={conversations}
        members={state.members}
        me={state.me}
        openId={openId}
        query={query}
        onQuery={setQuery}
        onlyUnread={onlyUnread}
        onToggleUnread={() => setOnlyUnread((v) => !v)}
        onOpen={open}
        onStartDirect={startDirect}
        className={showChat ? "hidden md:flex" : "flex"}
      />

      {detail ? (
        <ChatPane
          detail={{ ...detail, ...aoVivo(detail) }}
          me={state.me}
          sending={sending}
          emChamada={!!call}
          onSend={send}
          onStartCall={(withScreen) => setCall({ withScreen })}
          onToggleMuted={toggleMuted}
          onMarkUnread={markUnread}
          onBack={() => setShowChat(false)}
          onUndesigned={undesigned}
          className={showChat ? "flex" : "hidden md:flex"}
        />
      ) : (
        <div className="hidden min-w-0 flex-1 items-center justify-center p-8 md:flex">
          <p className="max-w-[280px] text-center text-[13px] leading-[19px] text-muted">
            {conversations.length === 0
              ? "Nenhuma conversa por aqui ainda."
              : "Escolha uma conversa à esquerda para ler e responder."}
          </p>
        </div>
      )}

      {call && detail && (
        <CallOverlay
          detail={detail}
          me={state.me}
          withScreen={call.withScreen}
          onClose={closeCall}
        />
      )}
    </section>
  );
}
