"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { CallOverlay } from "./CallOverlay";

/*
 * A chamada mora no shell, não no Inbox.
 *
 * Minimizada, ela vira o cartão do canto (como o do Discord) e a pessoa segue
 * trabalhando em Tarefas, Clientes, onde for — sem a sala cair. Para isso o
 * `CallOverlay` não pode desmontar ao trocar de página, então quem o monta é
 * o layout do app, e o Inbox só pede para ligar.
 */

type Chamada = {
  detail: ConversationDetail;
  me: InboxMember;
  withScreen: boolean;
};

type CallCtx = {
  /** A conversa em chamada agora, ou `null`. */
  activeId: string | null;
  start: (detail: ConversationDetail, me: InboxMember, withScreen: boolean) => void;
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
  const [call, setCall] = useState<Chamada | null>(null);
  const [minimized, setMinimized] = useState(false);
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

  function close(updated?: ConversationDetail) {
    setCall(null);
    setMinimized(false);
    ouvintes.current.forEach((ao) => ao(updated));
  }

  const value = useMemo<CallCtx>(
    () => ({ activeId: call?.detail.id ?? null, start, onEnded }),
    [call?.detail.id, start, onEnded],
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
          onMinimize={() => setMinimized(true)}
          onExpand={() => setMinimized(false)}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}
