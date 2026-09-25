"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { conversationChannel, memberChannel, type RealtimeEvent } from "@/lib/realtime/channels";
import { desktopBridge } from "@/lib/desktop";
import { initialsOf } from "@/lib/inbox/view";
import { alertRoute, DEFAULT_NOTIFY_PREFS, normalizeNotifyPrefs, type AlertRoute, type NotifyPrefs } from "@/lib/inbox/notifyPrefs";
import { isPresence } from "@/lib/inbox/constants";
import type { Presence } from "@/lib/inbox/types";
import { playAlertSound } from "@/components/settings/sounds";
import { PROFILE_CHANGED } from "@/components/settings/events";

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
 * Clicar abre a conversa — e, no desktop, traz a janela da bandeja. A
 * notificação leva o avatar de quem mandou (as iniciais, como no produto); o
 * nome "Black Berry" e o logo no cabeçalho vêm do app de desktop.
 *
 * Também entrega as **notificações** (menção, tarefa atribuída, comentário):
 * chegam pelo canal pessoal (ou pela releitura, sem tempo real), viram aviso
 * do sistema e atualizam o número de "Notificações" na lateral.
 *
 * "Você já está vendo" exige **foco**, não só a aba visível. No app de
 * desktop a página é criada com `backgroundThrottling: false` (para a chamada
 * seguir viva na bandeja), e isso faz o navegador dizer que ela está
 * *sempre* visível — com o Inbox aberto e a janela minimizada, nenhum aviso
 * chegava. E só a conversa que está aberta conta: estar no Inbox lendo uma
 * conversa não silencia as outras.
 *
 * Sem permissão de notificação no sistema, o aviso vira um toast dentro do
 * app, com "Abrir" — para não sumir calado.
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

/** Chegou ou foi lida uma notificação — a lateral e a tela de Notificações releem. */
export const NOTIFICATIONS_CHANGED = "bb:notificacoes-mudou";

export { PROFILE_CHANGED };

/** O que a pessoa escolheu em Configurações › Notificações, e como está agora. */
let alertPrefs: NotifyPrefs = DEFAULT_NOTIFY_PREFS;
let myPresence: Presence = "disponivel";

function applyProfile(detail: { notify?: unknown; presence?: unknown } | null | undefined) {
  if (!detail) return;
  if (detail.notify !== undefined) alertPrefs = normalizeNotifyPrefs(detail.notify);
  if (isPresence(detail.presence)) myPresence = detail.presence;
}

/**
 * Ligação que começa não é um dos quatro "o que avisar": avisa sempre no app.
 * Ocupado tira o sistema e o som, como nos outros avisos.
 */
function callRoute(): AlertRoute {
  const busy = myPresence === "ocupado";
  return {
    inApp: true,
    system: !busy && alertPrefs.system,
    sound: !busy && alertPrefs.sound !== "nenhum",
  };
}

/**
 * A conversa aberta agora no Inbox (a tela avisa ao trocar). É ela, e só
 * ela, que não precisa de aviso enquanto a janela está em foco.
 */
let openConversation: string | null = null;
export function setOpenConversation(id: string | null) {
  openConversation = id;
}

/** A pessoa está com os olhos nesta página agora? Foco, não só "aba visível". */
function watching(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

type NotificationSummary = {
  id: string;
  kind: "mencao" | "atribuicao" | "comentario" | "mensagem";
  title: string;
  body: string;
  href: string;
  ref: string;
  actor: string;
};

export function InboxNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { eventos, conectado, assinar, renovar } = useRealtime();
  const { toast } = useToast();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Os avisos e a disponibilidade de quem está logado: na entrada, quando a
  // janela volta ao foco e na hora em que Configurações salva.
  useEffect(() => {
    let vivo = true;
    const load = () =>
      fetch("/api/inbox/presence", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (vivo && data?.me) applyProfile(data.me);
        })
        .catch(() => undefined);
    const onChange = (e: Event) => applyProfile((e as CustomEvent).detail);
    void load();
    window.addEventListener(PROFILE_CHANGED, onChange);
    window.addEventListener("focus", load);
    return () => {
      vivo = false;
      window.removeEventListener(PROFILE_CHANGED, onChange);
      window.removeEventListener("focus", load);
    };
  }, []);

  /** Está olhando exatamente esta conversa, com a janela em foco. */
  const lookingAt = (conversationId: string) =>
    pathRef.current.startsWith("/inbox") && openConversation === conversationId && watching();

  const lookingAtRef = useRef(lookingAt);
  lookingAtRef.current = lookingAt;

  /** O aviso de uma notificação (menção, atribuição, comentário). */
  const announce = (n: NotificationSummary) => {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    // Mensagem comum já avisou pelo canal da conversa; aqui não repete.
    if (n.kind === "mensagem") return;
    const [kind, refId] = n.ref.split(":");
    if (kind === "conversa" && lookingAt(refId)) return;
    if (kind === "tarefa" && pathRef.current === `/tarefas/${refId}` && watching()) return;
    showNotification({
      route: alertRoute(alertPrefs, myPresence, n.kind),
      router,
      toast: toastRef.current,
      href: n.href,
      title: n.title,
      body: n.body || "Abra para ver.",
      // A menção numa conversa troca o aviso de mensagem dela (mesma etiqueta).
      tag: kind === "conversa" ? `conversa-${refId}` : `notificacao-${n.id}`,
      call: false,
      from: n.actor,
    });
  };
  const announceRef = useRef(announce);
  announceRef.current = announce;

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
    let seen: Set<string> | null = null;
    let me = "";
    async function tick() {
      // As notificações: toda não lida que não estava na rodada anterior é nova.
      try {
        const res = await fetch("/api/notificacoes?resumo=1", { cache: "no-store" });
        if (res.ok) {
          const { latest } = (await res.json()) as { latest: NotificationSummary[] };
          if (!vivo) return;
          const ids = new Set(latest.map((n) => n.id));
          if (seen) {
            const fresh = latest.filter((n) => !seen!.has(n.id));
            fresh.forEach((n) => announceRef.current(n));
            if (fresh.length === 0 && ids.size !== seen.size) {
              window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
            }
          }
          seen = ids;
        }
      } catch {
        // Sem rede nesta rodada: a próxima tenta.
      }
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
          if (newMessage && !c.muted && !lookingAtRef.current(c.id)) {
            showNotification({
              route: alertRoute(alertPrefs, myPresence, "mensagem"),
              router,
              toast: toastRef.current,
              href: conversationHref(c.id),
              title: c.title,
              body: c.preview || "Nova mensagem",
              tag: `conversa-${c.id}`,
              call: false,
              from: c.title,
            });
          }
          const callStarted =
            (prev?.callMemberIds.length ?? 0) === 0 && c.callMemberIds.length > 0 && !c.callMemberIds.includes(me);
          if (callStarted) {
            showNotification({
              route: callRoute(),
              router,
              toast: toastRef.current,
              href: conversationHref(c.id),
              title: c.kind === "grupo" ? `Chamada em ${c.title}` : `${c.title} está te ligando`,
              body: "Clique para abrir a conversa e entrar.",
              tag: `chamada-${c.id}`,
              call: true,
              from: c.title,
            });
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

    const notify = (id: string, title: string, body: string, call: boolean, from: string) =>
      showNotification({
        route: call ? callRoute() : alertRoute(alertPrefs, myPresence, "mensagem"),
        router,
        toast: toastRef.current,
        href: conversationHref(id),
        title,
        body,
        tag: call ? `chamada-${id}` : `conversa-${id}`,
        call,
        from,
      });

    function onEvent(e: RealtimeEvent) {
      if (!vivo) return;
      if (e.tipo === "mensagem") {
        window.dispatchEvent(new Event(INBOX_CHANGED));
        if (!e.from || e.from.id === me || muted.has(e.conversationId)) return;
        if (lookingAtRef.current(e.conversationId)) return;
        notify(
          e.conversationId,
          e.group ? `${e.from.name} em ${e.group}` : e.from.name,
          e.preview || "Nova mensagem",
          false,
          e.from.name,
        );
        return;
      }
      if (e.tipo === "chamada" && e.started && e.from && e.from.id !== me) {
        notify(
          e.conversationId,
          `${e.from.name} está te ligando`,
          e.group ? `Chamada em ${e.group} — clique para entrar.` : "Clique para abrir a conversa e entrar.",
          true,
          e.from.name,
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
          // No canal pessoal: uma notificação nova (menção, tarefa, comentário).
          if (e.tipo === "notificacao") {
            announceRef.current(e.notification);
            return;
          }
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

function conversationHref(id: string): string {
  return `/inbox?conversa=${encodeURIComponent(id)}`;
}

/**
 * O aviso do sistema; clicar leva para `href` (e traz o app da bandeja).
 * Sem permissão de notificação — recusada, ou navegador sem suporte —, o
 * aviso vira toast dentro do app, com "Abrir".
 */
function showNotification({
  route,
  router,
  toast,
  href,
  title,
  body,
  tag,
  call,
  from,
}: {
  /** Por onde este aviso pode sair (ver `alertRoute`). */
  route: AlertRoute;
  router: ReturnType<typeof useRouter>;
  toast: ReturnType<typeof useToast>["toast"];
  href: string;
  title: string;
  body: string;
  tag: string;
  call: boolean;
  /** De quem é o avatar: a pessoa que mandou ou ligou (ou o grupo, sem saber quem). */
  from: string;
}) {
  if (!route.inApp && !route.system) return;
  // O som toca mesmo sem permissão de notificação: é o aviso que sobra.
  if (route.sound) tocarSom();
  const open = () => {
    desktopBridge()?.show?.();
    window.focus();
    router.push(href);
  };
  const inApp = () =>
    toast(body && body !== "Abra para ver." ? `${title} — ${body}` : title, "info", {
      action: { label: "Abrir", onClick: open },
      duration: call ? 15_000 : 6_000,
    });
  // Só no app, ou o sistema não deixa (sem permissão, sem suporte): toast.
  if (!route.system || typeof Notification === "undefined" || Notification.permission !== "granted") {
    inApp();
    return;
  }
  try {
    const n = new Notification(title, {
      body,
      icon: avatarIcon(from),
      // Selo pequeno da marca (Android e alguns sistemas; o desktop usa o do app).
      badge: "/brand/notificacao.png",
      tag,
      // Mesma etiqueta substitui o aviso anterior — mas tem de avisar de novo.
      renotify: true,
      // Ligação fica na tela até alguém clicar; mensagem some sozinha.
      requireInteraction: call,
      // O som é o do black berry (abaixo), não o padrão do sistema.
      silent: true,
    } as NotificationOptions);
    n.onclick = () => {
      open();
      n.close();
    };
  } catch {
    // Navegador que não constrói notificação na página (Android): toast.
    inApp();
  }
}

const avatares = new Map<string, string>();

/*
 * O avatar de quem mandou, como imagem: as iniciais no círculo, com as cores
 * do produto (lidas dos tokens, não repetidas aqui). Ninguém tem foto no
 * black berry — o avatar é sempre este, então a notificação mostra o mesmo.
 */
function avatarIcon(name: string): string | undefined {
  const cached = avatares.get(name);
  if (cached) return cached;
  try {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue("--color-border-strong").trim() || "gray";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css.getPropertyValue("--color-fg").trim() || "white";
    ctx.font = `600 ${size * 0.38}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsOf(name), size / 2, size / 2 + size * 0.02);
    const url = canvas.toDataURL("image/png");
    avatares.set(name, url);
    return url;
  } catch {
    return undefined;
  }
}

let ultimoSom = 0;

/** O somzinho do black berry. Várias mensagens de uma vez tocam uma vez só. */
function tocarSom() {
  const agora = Date.now();
  if (agora - ultimoSom < 1500) return;
  ultimoSom = agora;
  // O som escolhido em Configurações. Navegador que ainda não viu um clique
  // na página recusa o som: segue calado.
  playAlertSound(alertPrefs.sound);
}

/**
 * "Enviar teste" (Configurações › Notificações): um aviso de mentira pelo
 * mesmo caminho dos de verdade, com as escolhas que estão na tela agora.
 */
export function sendTestNotification(
  toast: ReturnType<typeof useToast>["toast"],
  prefs: NotifyPrefs,
): "sistema" | "app" {
  const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
  if (prefs.sound !== "nenhum") playAlertSound(prefs.sound);
  if (prefs.system && granted) {
    try {
      new Notification("Aviso de teste", {
        body: "É assim que o black berry te avisa.",
        icon: "/brand/notificacao.png",
        tag: "teste",
        silent: true,
      } as NotificationOptions);
      return "sistema";
    } catch {
      // Cai no toast abaixo.
    }
  }
  toast("Aviso de teste — é assim que o black berry te avisa.", "info");
  return "app";
}
