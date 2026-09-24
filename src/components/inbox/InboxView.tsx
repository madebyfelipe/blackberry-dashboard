"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/components/ui/useIsMobile";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { conversationChannel, memberChannel } from "@/lib/realtime/channels";
import type {
  ConversationDetail,
  ConversationSummary,
  InboxMember,
  Message,
} from "@/lib/inbox/types";
import { sortSummaries } from "@/lib/inbox/view";
import { coalesce } from "@/lib/ui/coalesce";
import {
  apiAddMember,
  apiConversation,
  apiCreateGroup,
  apiDeleteMessage,
  apiEditMessage,
  apiInbox,
  apiOpenDirect,
  apiPatchConversation,
  apiSendMessage,
  type InboxSnapshot,
  type OutgoingExtra,
} from "./api";
import { useCall } from "./CallProvider";
import { ChatPane } from "./ChatPane";
import { setOpenConversation } from "./InboxNotifier";
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
  live = false,
  blobUploads = false,
}: {
  snapshot: InboxSnapshot;
  initialConversation: ConversationDetail | null;
  /** O Blob está configurado: anexos sobem direto do navegador para o store. */
  blobUploads?: boolean;
  /**
   * O tempo real está configurado. Aí a presença gravada não aparece nem por
   * um instante: ela era o status do seed ("Marina disponível"), que piscava
   * na tela até a lista ao vivo chegar e apagar quem não está conectado.
   */
  live?: boolean;
}) {
  const { toast } = useToast();
  const { eventos, conectado, presencaPronta, online, assinar, renovar } = useRealtime();
  /*
   * Presença ao vivo só vale com a conexão de pé **e** a lista sincronizada.
   * Entre um e outro (reconexão, crachá novo) a lista pode vir pela metade, e
   * usá-la pintaria de offline quem está aqui — era o que acontecia ao entrar
   * e sair de chamada.
   */
  const aoVivoOk = eventos && conectado && presencaPronta;
  const [state, setState] = useState(snapshot);
  const [detail, setDetail] = useState<ConversationDetail | null>(
    initialConversation,
  );
  const [openId, setOpenId] = useState<string | null>(
    initialConversation?.id ?? null,
  );
  /** Celular: a conversa cobre a lista. No desktop as duas convivem. */
  const [showChat, setShowChat] = useState(false);
  const mobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sending, setSending] = useState(false);
  /** A chamada mora no shell (ver `CallProvider`): minimizada, ela segue em qualquer tela. */
  const call = useCall();

  const openIdRef = useRef(openId);
  openIdRef.current = openId;

  /*
   * No celular a conversa cobre a tela como uma página própria — então o
   * "voltar" do aparelho (gesto do iPhone, botão do Android) tem de voltar
   * para a lista, e não sair do Inbox. Abrir a conversa empurra uma entrada
   * no histórico; voltar a tira e fecha a conversa.
   */
  useEffect(() => {
    if (!showChat || !window.matchMedia("(max-width: 767px)").matches) return;
    window.history.pushState({ ...window.history.state, bbChat: true }, "");
    const onPop = () => setShowChat(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Fechou pela seta da tela: a entrada que empurramos sai junto.
      if (window.history.state?.bbChat) window.history.back();
    };
  }, [showChat]);

  // O notificador do shell não avisa a conversa que está aberta aqui (com a janela em foco).
  useEffect(() => {
    setOpenConversation(openId);
    return () => setOpenConversation(null);
  }, [openId]);

  /*
   * Clique numa notificação com o Inbox já aberto: a página chega com outra
   * conversa em `?conversa=`, mas este componente continua montado — então
   * ele troca para ela aqui (e, no celular, já abre o chat).
   */
  const initialId = initialConversation?.id ?? null;
  useEffect(() => {
    if (!initialConversation || initialConversation.id === openIdRef.current) return;
    setDetail(initialConversation);
    setOpenId(initialConversation.id);
    setShowChat(true);
    // Só quando a conversa pedida muda — não a cada releitura da página.
  }, [initialId]); // eslint-disable-line react-hooks/exhaustive-deps
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
      // Esperando a lista ao vivo: presença desconhecida (-1), não a gravada.
      if (!aoVivoOk) return live ? { ...item, presence: null, onlineCount: -1 } : item;
      const outro = item.memberIds.find((id) => id !== state.me.id);
      return {
        ...item,
        presence:
          item.kind === "direta" ? (outro ? (online[outro] ?? "offline") : "offline") : null,
        onlineCount: item.memberIds.filter((id) => !!online[id]).length,
      };
    },
    [aoVivoOk, live, online, state.me.id],
  );

  /** A equipe com a presença de agora — é dela que sai o "adicionar alguém". */
  const team = useMemo<InboxMember[]>(() => {
    // Convidado sem conta, inativo e arquivado não entram em conversa nova.
    const working = state.members.filter((m) => m.status === "ativo");
    return aoVivoOk
      ? working.map((m) => ({ ...m, presence: online[m.id] ?? "offline" }))
      : working;
  }, [aoVivoOk, online, state.members]);

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

  /**
   * Relê o estado inteiro — a lista e, se houver, a conversa aberta.
   *
   * Uma releitura por vez (`coalesce`): cada mensagem que chega, o foco e a
   * aba voltando pedem uma, e numa rajada elas saíam todas juntas — com a
   * resposta mais velha podendo chegar por último e desfazer a mais nova.
   */
  const refresh = useMemo(() => coalesce(async () => {
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
        /*
         * Só com a janela em foco: minimizada (ou na bandeja do desktop),
         * ninguém está lendo — e dar por lida apagaria o aviso e o número.
         */
        if (updated.unread > 0 && document.hasFocus()) {
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
  }), []);

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
    const meId = state.me.id;
    let vivo = true;
    let cancelar: (() => void)[] = [];
    (async () => {
      const canais = [
        memberChannel(agencyId, meId),
        ...idsAssinados
          .split(",")
          .filter(Boolean)
          .map((id) => conversationChannel(agencyId, id)),
      ];
      /*
       * Crachá novo antes de assinar — mas só se faltar permissão. O crachá
       * foi emitido quando o app abriu, com as conversas daquele instante: um
       * grupo criado depois ficaria fora dele e o canal falharia calado.
       * Renovar sem precisar faz o Ably reconectar os canais, e a presença
       * piscava de offline no meio.
       */
      await renovar(canais);
      if (!vivo) return;
      // O canal pessoal avisa "suas conversas mudaram" (um grupo com você).
      cancelar = canais.map((canal) =>
        assinar(canal, () => {
          void refresh();
        }),
      );
    })();
    return () => {
      vivo = false;
      cancelar.forEach((parar) => parar());
    };
  }, [idsAssinados, eventos, conectado, assinar, renovar, state.me.agencyId, state.me.id, refresh]);

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

  /*
   * O "adicionar alguém" da conversa aberta. Num grupo, a pessoa entra nele.
   * Numa direta, nasce um grupo com as três pessoas e ele abre na hora — a
   * direta fica como estava.
   */
  async function addPerson(memberId: string) {
    const current = detail;
    if (!current) return;
    const name = state.members.find((m) => m.id === memberId)?.name ?? "A pessoa";
    try {
      if (current.kind === "grupo") {
        const updated = await apiAddMember(current.id, memberId);
        setDetail((d) => (d?.id === updated.id ? updated : d));
        toast(`${name} entrou no grupo.`, "success");
      } else {
        const others = current.members.filter((m) => m.id !== state.me.id).map((m) => m.id);
        const group = await apiCreateGroup([...others, memberId]);
        setDetail(group);
        setOpenId(group.id);
        setShowChat(true);
        toast(`Grupo criado com ${group.title}.`, "success");
      }
      await refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function send(text: string, extra: OutgoingExtra = {}) {
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
      attachments: [
        ...(extra.attachments ?? []),
        ...(extra.gif
          ? [
              {
                id: `gif-${extra.gif.id}`,
                kind: "gif" as const,
                url: extra.gif.url,
                name: extra.gif.title,
                mime: "image/gif",
                size: 0,
                width: extra.gif.width,
                height: extra.gif.height,
              },
            ]
          : []),
      ],
      replyToId: extra.replyToId ?? null,
      editedAt: null,
      deletedAt: null,
    };
    setDetail((d) => (d ? { ...d, messages: [...d.messages, pending] } : d));
    setSending(true);
    try {
      const updated = await apiSendMessage(id, text, extra);
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

  /** Edita a própria mensagem (até 10 min). Erro volta para quem chamou manter a edição aberta. */
  async function editMessage(message: Message, text: string) {
    const id = detail?.id;
    if (!id) return;
    try {
      const updated = await apiEditMessage(id, message.id, text);
      setDetail((d) => (d?.id === updated.id ? updated : d));
      void refresh();
    } catch (err) {
      fail(err);
      throw err;
    }
  }

  /** Apaga a própria mensagem (até 10 min): some da tela na hora, volta se o servidor recusar. */
  async function deleteMessage(message: Message) {
    const id = detail?.id;
    if (!id) return;
    const before = detail;
    setDetail((d) =>
      d
        ? {
            ...d,
            messages: d.messages.map((m) =>
              m.id === message.id
                ? { ...m, text: "", attachments: [], deletedAt: new Date().toISOString() }
                : m,
            ),
          }
        : d,
    );
    try {
      const updated = await apiDeleteMessage(id, message.id);
      setDetail((d) => (d?.id === updated.id ? updated : d));
      void refresh();
    } catch (err) {
      setDetail((d) => (d?.id === before?.id ? before : d));
      fail(err);
    }
  }

  /*
   * A chamada fechou. Quem sai por último deixa a linha no histórico, e o
   * servidor devolve a conversa já com ela — por isso a tela aceita a
   * conversa de volta em vez de recarregar tudo às cegas.
   */
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(
    () =>
      call.onEnded((updated) => {
        if (updated) setDetail((d) => (d?.id === updated.id ? updated : d));
        void refreshRef.current();
      }),
    [call],
  );

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
        members={team}
        me={state.me}
        // No celular a lista só aparece com a conversa fechada: nenhuma linha acesa.
        openId={mobile && !showChat ? null : openId}
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
          emChamada={call.activeId === detail.id}
          blobUploads={blobUploads}
          onSend={send}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onError={(message) => toast(message, "error")}
          onStartCall={(withScreen) => {
            if (call.activeId && call.activeId !== detail.id) {
              toast("Encerre a chamada em andamento antes de começar outra.", "info");
              return;
            }
            call.start(detail, state.me, withScreen);
          }}
          onToggleMuted={toggleMuted}
          onMarkUnread={markUnread}
          onBack={() => setShowChat(false)}
          onUndesigned={undesigned}
          team={team}
          onAddPerson={addPerson}
          className={
            showChat
              ? // Celular: por cima de tudo, a tela inteira (com a área segura do iPhone).
                "flex max-md:fixed max-md:inset-0 max-md:z-40 max-md:animate-slide-in-right max-md:bg-surface max-md:pt-[env(safe-area-inset-top)]"
              : "hidden md:flex"
          }
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

    </section>
  );
}
