import type { Presence } from "./types";

/*
 * O que merece aviso, por onde ele chega e com que som (Configurações ›
 * Pessoal › Notificações). É da **pessoa**, não do aparelho: fica no membro
 * do time e vale no site, no celular e no app de desktop.
 *
 * O aviso é o que interrompe (toast no canto, notificação do sistema, som).
 * A notificação em si continua registrada na tela de Notificações — desligar
 * "Comentários" não apaga comentário de ninguém, só para de interromper.
 */

/** Os quatro "o que avisar" do desenho. */
export type AlertKind = "mencao" | "atribuicao" | "comentario" | "mensagem";

export const ALERT_KINDS: AlertKind[] = ["mencao", "atribuicao", "comentario", "mensagem"];

/**
 * Os sons do aviso. "black berry" é o som que o app sempre teve (um arquivo);
 * os outros são sintetizados no navegador (`components/settings/sounds.ts`).
 */
export type AlertSound = "blackberry" | "gota" | "sino" | "estalo" | "nenhum";

export const ALERT_SOUNDS: { id: AlertSound; label: string }[] = [
  { id: "blackberry", label: "black berry" },
  { id: "gota", label: "Gota" },
  { id: "sino", label: "Sino" },
  { id: "estalo", label: "Estalo" },
  { id: "nenhum", label: "Nenhum" },
];

export type NotifyPrefs = {
  kinds: Record<AlertKind, boolean>;
  /** "No app": o toast no canto da tela. */
  inApp: boolean;
  /** "Notificação do sistema": a do navegador, ou a nativa no app de desktop. */
  system: boolean;
  sound: AlertSound;
};

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  kinds: { mencao: true, atribuicao: true, comentario: true, mensagem: true },
  inApp: true,
  system: true,
  sound: "blackberry",
};

export function isAlertSound(v: unknown): v is AlertSound {
  return ALERT_SOUNDS.some((s) => s.id === v);
}

/** O que veio do arquivo (ou do navegador), com o padrão no que faltar. */
export function normalizeNotifyPrefs(raw: unknown): NotifyPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<NotifyPrefs>;
  const k = (r.kinds && typeof r.kinds === "object" ? r.kinds : {}) as Partial<Record<AlertKind, unknown>>;
  const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    kinds: {
      mencao: flag(k.mencao, true),
      atribuicao: flag(k.atribuicao, true),
      comentario: flag(k.comentario, true),
      mensagem: flag(k.mensagem, true),
    },
    inApp: flag(r.inApp, true),
    system: flag(r.system, true),
    sound: isAlertSound(r.sound) ? r.sound : DEFAULT_NOTIFY_PREFS.sound,
  };
}

/** Por onde um aviso sai agora — ou por nenhum lugar. */
export type AlertRoute = { inApp: boolean; system: boolean; sound: boolean };

/**
 * A régua do aviso. O tipo desligado não avisa por lugar nenhum. **Ocupado**
 * silencia a notificação do sistema e o som, mas a menção continua chegando
 * no app (é para isso que o @ existe); o resto espera na tela de Notificações.
 */
export function alertRoute(prefs: NotifyPrefs, presence: Presence, kind: AlertKind): AlertRoute {
  if (!prefs.kinds[kind]) return { inApp: false, system: false, sound: false };
  if (presence === "ocupado") {
    return { inApp: prefs.inApp && kind === "mencao", system: false, sound: false };
  }
  const inApp = prefs.inApp;
  const system = prefs.system;
  return { inApp, system, sound: (inApp || system) && prefs.sound !== "nenhum" };
}
