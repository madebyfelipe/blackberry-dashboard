"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { conversationChannel, memberChannel, type RealtimeEvent } from "@/lib/realtime/channels";
import { desktopBridge } from "@/lib/desktop";

/*
 * Notificações de mensagem e de ligação, em qualquer tela do produto.
 *
 * Mora no shell (não no Inbox) porque o aviso só faz sentido para quem NÃO
 * está olhando a conversa: em Tarefas, com a aba escondida, com o app de
 * desktop na bandeja. Ouve os canais de todas as suas conversas (o crachá do
 * tempo real já dá permissão para eles) e usa a notificação do sistema —
 * nativa no app de desktop, a do navegador no site.
 *
 * Quando avisa:
 * - mensagem de outra pessoa, em conversa não silenciada, a não ser que você
 *   esteja no Inbox com a aba à vista (a conversa já está na sua frente);
 * - alguém **começou** uma chamada numa conversa sua ("está te ligando").
 *
 * Clicar abre a conversa — e, no desktop, traz a janela da bandeja.
 *
 * Sem tempo real configurado (`eventos` falso) não há o que ouvir: nada liga.
 */

type SubConversation = {
  id: string;
  muted: boolean;
  kind: "grupo" | "direta";
  title: string;
  preview: string;
  unread: number;
  lastAt: string | null;
  callMemberIds: string[];
};
type Subs = { agencyId: string; me: string; conversations: SubConversation[] };

/** De quanto em quanto tempo o aviso por releitura confere (sem tempo real). */
const POLL_MS = 20_000;

/** Avisa a lateral (não lidas) e quem mais quiser saber que o Inbox mudou. */
export const INBOX_CHANGED = "bb:inbox-mudou";

export function InboxNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { eventos, conectado, assinar, renovar } = useRealtime();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // A permissão só pode ser pedida num gesto da pessoa: o primeiro clique.
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    const ask = () => void Notification.requestPermission().catch(() => undefined);
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, []);

  /*
   * Sem tempo real funcionando (chave do Ably sem permissão, ou nenhuma), o
   * aviso vem por releitura: a cada 20s compara as conversas com a última
   * vez — não lida nova vira aviso de mensagem, chamada que começou sem você
   * vira "está te ligando". Chega com até 20s de atraso, mas chega.
   */
  useEffect(() => {
    if (eventos) return;
    let vivo = true;
    let before: Map<string, SubConversation> | null = null;
    let me = "";
    async function tick() {
      let subs: Subs;
      try {
        const res = await fetch("/api/inbox/assinaturas", { cache: "no-store" });
        if (!res.ok) return;
        subs = await res.json();
      } catch {
        return;
      }
      if (!vivo) return;
      me = subs.me;
      const now = new Map(subs.conversations.map((c) => [c.id, c]));
      if (before) {
        let changed = false;
        for (const c of subs.conversations) {
          const prev = before.get(c.id);
          const newMessage = c.unread > (prev?.unread ?? 0) && c.lastAt !== (prev?.lastAt ?? null);
          if (newMessage) changed = true;
          const looking = pathRef.current.startsWith("/inbox") && document.visibilityState === "visible";
          if (newMessage && !c.muted && !looking) {
            showNotification(router, c.id, c.title, c.preview || "Nova mensagem", false);
          }
          const callStarted =
            (prev?.callMemberIds.length ?? 0) === 0 && c.callMemberIds.length > 0 && !c.callMemberIds.includes(me);
          if (callStarted) {
            showNotification(
              router,
              c.id,
              c.kind === "grupo" ? `Chamada em ${c.title}` : `${c.title} está te ligando`,
              "Clique para abrir a conversa e entrar.",
              true,
            );
          }
        }
        if (changed) window.dispatchEvent(new Event(INBOX_CHANGED));
      }
      before = now;
    }
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [eventos, router]);

  useEffect(() => {
    if (!eventos || !conectado) return;
    let vivo = true;
    let parar: (() => void)[] = [];
    let muted = new Set<string>();
    let me = "";

    const notify = (id: string, title: string, body: string, call: boolean) =>
      showNotification(router, id, title, body, call);

    function onEvent(e: RealtimeEvent) {
      if (!vivo) return;
      if (e.tipo === "mensagem") {
        window.dispatchEvent(new Event(INBOX_CHANGED));
        if (!e.from || e.from.id === me || muted.has(e.conversationId)) return;
        const looking = pathRef.current.startsWith("/inbox") && document.visibilityState === "visible";
        if (looking) return;
        notify(
          e.conversationId,
          e.group ? `${e.from.name} em ${e.group}` : e.from.name,
          e.preview || "Nova mensagem",
          false,
        );
        return;
      }
      if (e.tipo === "chamada" && e.started && e.from && e.from.id !== me) {
        notify(
          e.conversationId,
          `${e.from.name} está te ligando`,
          e.group ? `Chamada em ${e.group} — clique para entrar.` : "Clique para abrir a conversa e entrar.",
          true,
        );
      }
    }

    async function subscribe() {
      let subs: Subs;
      try {
        const res = await fetch("/api/inbox/assinaturas", { cache: "no-store" });
        if (!res.ok) return;
        subs = await res.json();
      } catch {
        return;
      }
      if (!vivo) return;
      me = subs.me;
      muted = new Set(subs.conversations.filter((c) => c.muted).map((c) => c.id));
      const canais = [
        memberChannel(subs.agencyId as never, subs.me),
        ...subs.conversations.map((c) => conversationChannel(subs.agencyId as never, c.id)),
      ];
      // Crachá novo só se faltar permissão para algum canal (conversa nova).
      await renovar(canais);
      if (!vivo) return;
      parar.forEach((p) => p());
      parar = canais.map((canal) =>
        assinar(canal, (e) => {
          // No canal pessoal, "suas conversas mudaram": reassina com a lista nova.
          if (e.tipo === "conversas") {
            window.dispatchEvent(new Event(INBOX_CHANGED));
            void subscribe();
            return;
          }
          onEvent(e);
        }),
      );
    }

    void subscribe();
    return () => {
      vivo = false;
      parar.forEach((p) => p());
    };
  }, [eventos, conectado, assinar, renovar, router]);

  return null;
}

/** A notificação do sistema; clicar abre a conversa (e traz o app da bandeja). */
function showNotification(
  router: ReturnType<typeof useRouter>,
  id: string,
  title: string,
  body: string,
  call: boolean,
) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag: call ? `chamada-${id}` : `conversa-${id}`,
      // Ligação fica na tela até alguém clicar; mensagem some sozinha.
      requireInteraction: call,
      silent: false,
    });
    n.onclick = () => {
      desktopBridge()?.show?.();
      window.focus();
      router.push(`/inbox?conversa=${encodeURIComponent(id)}`);
      n.close();
    };
  } catch {
    // Navegador sem suporte a construir notificação na página: sem aviso.
  }
}
