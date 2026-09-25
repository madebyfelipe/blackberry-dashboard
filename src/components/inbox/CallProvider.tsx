"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { CallOverlay } from "./CallOverlay";

/*
 * A chamada mora no shell, não no Inbox.
 *
 * Minimizada, ela vira o cartão do canto (como o do Discord) e a pessoa segue
 * trabalhando em Tarefas, Clientes, onde for — sem a sala cair. Para isso o
 * `CallOverlay` não pode desmontar ao trocar de página, então quem o monta é
 * o layout do app, e o Inbox só pede para ligar.
 *
 * Aberta, ela ocupa o lugar da conversa no Inbox (export "Call View"): o
 * Inbox marca esse lugar (`setSlot`) e a chamada se posiciona em cima dele,
 * sem sair do lugar no DOM — trocar de pai desmontaria os vídeos. Sem lugar
 * marcado (celular, outra tela) ela ocupa a tela inteira.
 */

type Chamada = {
  detail: ConversationDetail;
  me: InboxMember;
  withScreen: boolean;
};

type CallCtx = {
  /** A conversa em chamada agora, ou `null`. */
  activeId: string | null;
  /** Recolhida no cartão do canto. */
  minimized: boolean;
  start: (detail: ConversationDetail, me: InboxMember, withScreen: boolean) => void;
  minimize: () => void;
  /** Abre a chamada — no Inbox, na conversa dela. */
  expand: () => void;
  /** O lugar da conversa no Inbox, onde a chamada aberta se desenha. */
  setSlot: (el: HTMLElement | null) => void;
  /**
   * Avisa quando a chamada fecha, com a conversa atualizada quando o
   * servidor respondeu. Devolve a função de parar de ouvir.
   */
  onEnded: (ao: (conversation?: ConversationDetail) => void) => () => void;
};

const Ctx = createContext<CallCtx | null>(null);

export function useCall(): CallCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCall fora do CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [call, setCall] = useState<Chamada | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [slot, setSlotState] = useState<HTMLElement | null>(null);
  const ouvintes = useRef(new Set<(c?: ConversationDetail) => void>());

  const start = useCallback(
    (detail: ConversationDetail, me: InboxMember, withScreen: boolean) => {
      // Uma chamada por vez: quem já está numa não abre a segunda por cima.
      setCall((atual) => atual ?? { detail, me, withScreen });
      setMinimized(false);
    },
    [],
  );

  const onEnded = useCallback((ao: (c?: ConversationDetail) => void) => {
    ouvintes.current.add(ao);
    return () => void ouvintes.current.delete(ao);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const setSlot = useCallback((el: HTMLElement | null) => setSlotState(el), []);

  const callId = call?.detail.id ?? null;
  const expand = useCallback(() => {
    setMinimized(false);
    // Fora do Inbox, abrir a chamada leva até a conversa dela — é lá que ela mora.
    if (callId && pathname !== "/inbox") router.push(`/inbox?conversa=${callId}`);
  }, [callId, pathname, router]);

  function close(updated?: ConversationDetail) {
    setCall(null);
    setMinimized(false);
    ouvintes.current.forEach((ao) => ao(updated));
  }

  const value = useMemo<CallCtx>(
    () => ({ activeId: callId, minimized, start, minimize, expand, setSlot, onEnded }),
    [callId, minimized, start, minimize, expand, setSlot, onEnded],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {call && (
        <CallOverlay
          detail={call.detail}
          me={call.me}
          withScreen={call.withScreen}
          minimized={minimized}
          slot={minimized ? null : slot}
          onMinimize={minimize}
          onExpand={expand}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}
