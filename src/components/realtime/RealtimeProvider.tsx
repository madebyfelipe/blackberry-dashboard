"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeEvent } from "@/lib/realtime/channels";
import { presenceChannel } from "@/lib/realtime/channels";
import type { InboxMember, Presence } from "@/lib/inbox/types";

/*
 * A conexão de tempo real do produto inteiro — não só do Inbox.
 *
 * Ela vive no shell autenticado por um motivo de comportamento, não de
 * arquitetura: presença é "esta pessoa está com o produto aberto". Se a
 * conexão só existisse dentro de `/inbox`, quem estivesse trabalhando em
 * Tarefas apareceria como offline para o time — que é exatamente o contrário
 * do que a bolinha promete.
 *
 * Duas coisas passam por aqui:
 *
 * - **Presença.** Quem está conectado *está* online; o status escolhido
 *   (disponível, ocupado, ausente) é um dado em cima disso. Offline deixa de
 *   ser um valor que alguém precisa marcar na mão e volta a ser o que
 *   sempre foi: não estar aqui. Fechar a aba derruba a presença sozinho.
 * - **Eventos das conversas.** Um empurrão por conversa ("tem coisa nova"),
 *   e quem recebe vai buscar o conteúdo pela API de sempre.
 *
 * Sem `ABLY_API_KEY` no ambiente, nada disso liga: `eventos` fica falso, e o
 * Inbox volta à releitura periódica. A tela funciona dos dois jeitos.
 */

type RealtimeCtx = {
  /** O tempo real está configurado neste ambiente? */
  eventos: boolean;
  /** E a chamada tem provedor de mídia? */
  chamada: boolean;
  /** A conexão está de pé agora? */
  conectado: boolean;
  /**
   * A lista de quem está online é de agora? Falso enquanto o canal de
   * presença (re)sincroniza — e aí a tela usa o status gravado, porque uma
   * lista pela metade pintaria de offline quem está aqui.
   */
  presencaPronta: boolean;
  /** Você, como membro da equipe. `undefined` até a primeira resposta. */
  me?: InboxMember;
  /** Quem está com o app aberto agora, e como: id do membro → status. */
  online: Record<string, Presence>;
  /** Anuncia o seu status para o time (quem grava é quem chama). */
  anunciar: (status: Presence) => void;
  /** Ouve o canal de uma conversa. Devolve a função de parar de ouvir. */
  assinar: (canal: string, ao: (evento: RealtimeEvent) => void) => () => void;
  /**
   * Renova o crachá — a permissão lista as conversas de quando foi emitida.
   * Com `canais`, só renova se algum deles estiver fora da permissão atual:
   * renovar à toa faz o Ably reconectar canais, e a presença pisca no meio.
   * Resolve quando o crachá novo já vale (ou quando falhou: quem espera segue).
   */
  renovar: (canais?: string[]) => Promise<void>;
};

const Ctx = createContext<RealtimeCtx>({
  eventos: false,
  chamada: false,
  conectado: false,
  presencaPronta: false,
  online: {},
  anunciar: () => {},
  assinar: () => () => {},
  renovar: async () => {},
});

export function useRealtime(): RealtimeCtx {
  return useContext(Ctx);
}

/** O mínimo do cliente do Ably que este provedor usa. */
type AblyChannel = {
  on: (estado: string[], handler: () => void) => void;
  subscribe: (handler: (msg: { data: unknown }) => void) => void;
  unsubscribe: (handler: (msg: { data: unknown }) => void) => void;
  presence: {
    enter: (data: unknown) => Promise<void>;
    update: (data: unknown) => Promise<void>;
    get: () => Promise<{ clientId?: string; data?: unknown }[]>;
    subscribe: (handler: () => void) => Promise<unknown>;
  };
};
type AblyClient = {
  channels: { get: (name: string) => AblyChannel };
  connection: { on: (event: string, handler: () => void) => void };
  auth: {
    authorize: () => Promise<unknown>;
    tokenDetails?: { capability?: string };
  };
  close: () => void;
};

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<InboxMember>();
  const [flags, setFlags] = useState({ eventos: false, chamada: false });
  const [conectado, setConectado] = useState(false);
  const [presencaPronta, setPresencaPronta] = useState(false);
  /** Leituras de presença em voo: só a mais nova pode escrever na tela. */
  const leituraRef = useRef(0);
  const [online, setOnline] = useState<Record<string, Presence>>({});
  const clientRef = useRef<AblyClient | null>(null);
  const presenceRef = useRef<AblyChannel | null>(null);
  /** O status vale para a conexão; guardado para reentrar depois de uma queda. */
  const statusRef = useRef<Presence>("disponivel");
  /** O seu id de membro, para o seu próprio ponto mudar sem esperar o servidor. */
  const meIdRef = useRef<string>("");

  useEffect(() => {
    let vivo = true;
    let client: AblyClient | null = null;

    (async () => {
      let info: { me: InboxMember; realtime: { eventos: boolean; chamada: boolean } };
      try {
        const res = await fetch("/api/inbox/presence", { cache: "no-store" });
        if (!res.ok) return;
        info = await res.json();
      } catch {
        // Sem resposta, o produto segue — só não há presença nem eventos.
        return;
      }
      if (!vivo) return;

      setMe(info.me);
      setFlags(info.realtime);
      statusRef.current = info.me.presence;
      meIdRef.current = info.me.id;
      if (!info.realtime.eventos) return;

      /*
       * A biblioteca entra por import dinâmico: quem nunca abre o Inbox não
       * paga o peso dela no primeiro carregamento de Tarefas ou Clientes.
       */
      const Ably = await import("ably");
      if (!vivo) return;

      client = new Ably.Realtime({
        // O navegador nunca vê a chave da conta: ele busca um crachá
        // assinado, escopado nas conversas dele (ver /api/realtime/token).
        authUrl: "/api/realtime/token",
        clientId: info.me.id,
      }) as unknown as AblyClient;
      clientRef.current = client;

      client.connection.on("connected", () => vivo && setConectado(true));
      client.connection.on("disconnected", () => vivo && setConectado(false));
      client.connection.on("suspended", () => vivo && setConectado(false));
      client.connection.on("failed", () => vivo && setConectado(false));

      const canal = client.channels.get(presenceChannel(info.me.agencyId));
      presenceRef.current = canal;

      /*
       * Cada evento de presença dispara uma leitura, e elas podem voltar fora
       * de ordem: a de antes de alguém entrar chegando depois da de depois.
       * Sem este número, a leitura velha apagaria quem acabou de chegar.
       */
      async function ler() {
        const minha = ++leituraRef.current;
        try {
          const presentes = await canal.presence.get();
          if (!vivo || minha !== leituraRef.current) return;
          setPresencaPronta(true);
          setOnline(
            Object.fromEntries(
              presentes
                .filter((p) => p.clientId)
                .map((p) => [
                  p.clientId as string,
                  ((p.data as { status?: Presence } | undefined)?.status ??
                    "disponivel") as Presence,
                ]),
            ),
          );
        } catch {
          // Presença é informação de apoio: falhar em lê-la não tira nada da
          // tela, só deixa a bolinha desatualizada até o próximo evento.
        }
      }

      // Canal reconectando (queda, crachá novo): até sincronizar de novo, a
      // lista que temos não é de agora.
      canal.on(["attaching", "detached", "suspended", "failed"], () => {
        if (vivo) setPresencaPronta(false);
      });
      canal.on(["attached"], () => void ler());

      try {
        await canal.presence.subscribe(ler);
        await canal.presence.enter({ status: statusRef.current });
        await ler();
      } catch {
        // idem
      }
    })();

    return () => {
      vivo = false;
      clientRef.current?.close();
      clientRef.current = null;
      presenceRef.current = null;
    };
  }, []);

  const anunciar = useCallback((status: Presence) => {
    statusRef.current = status;
    // Otimista: o seu próprio ponto muda na hora, sem esperar a ida e volta.
    setMe((m) => (m ? { ...m, presence: status } : m));
    const id = meIdRef.current;
    if (id) setOnline((o) => ({ ...o, [id]: status }));
    presenceRef.current?.presence.update({ status }).catch(() => undefined);
  }, []);

  const assinar = useCallback(
    (canal: string, ao: (evento: RealtimeEvent) => void) => {
      const client = clientRef.current;
      if (!client) return () => {};
      const ch = client.channels.get(canal);
      const handler = (msg: { data: unknown }) => ao(msg.data as RealtimeEvent);
      ch.subscribe(handler);
      return () => ch.unsubscribe(handler);
    },
    [],
  );

  const renovar = useCallback(async (canais?: string[]) => {
    const client = clientRef.current;
    if (!client) return;
    if (canais) {
      try {
        const permitidos = JSON.parse(client.auth.tokenDetails?.capability ?? "{}");
        if (canais.every((c) => c in permitidos)) return;
      } catch {
        // Permissão ilegível: renovar é o caminho seguro.
      }
    }
    await client.auth.authorize().catch(() => undefined);
  }, []);

  const value = useMemo<RealtimeCtx>(
    () => ({ ...flags, conectado, presencaPronta, me, online, anunciar, assinar, renovar }),
    [flags, conectado, presencaPronta, me, online, anunciar, assinar, renovar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
