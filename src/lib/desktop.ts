/*
 * O app de desktop (Electron, pasta `desktop/`) abre este mesmo site e expõe
 * `window.blackberryDesktop` pelo `desktop/src/preload.js`. No navegador ela
 * não existe: tudo aqui devolve `null` e a página segue igual.
 */

export type DesktopBridge = {
  platform: string;
  /** Avisa o app que a chamada começou/acabou — liga o atalho global de mudo. */
  setInCall: (emChamada: boolean) => void;
  /** Atalho global de mudo. Devolve a função que para de ouvir. */
  onToggleMute: (callback: () => void) => () => void;
  /** 0.0.5+: traz a janela (clique numa notificação com o app na bandeja). */
  show?: () => void;
  /** 0.0.5+: as não lidas do Inbox, para a bandeja e a barra de tarefas. */
  setUnread?: (total: number) => void;
  /**
   * 0.0.7+: o seletor de tela do app é o modal "Compartilhar tela" do
   * desenho, com resolução, quadros e som — a página não abre o dela antes.
   * `false` no macOS (lá vale o seletor do sistema).
   */
  sharePicker?: boolean;
  /** 0.0.7+: a qualidade que a página usa hoje — o seletor abre com ela marcada. */
  setShareQuality?: (q: DesktopShareQuality) => void;
  /** 0.0.7+: o que foi escolhido no seletor, uma vez só; `null` se nada. */
  takeShareQuality?: () => Promise<DesktopShareQuality | null>;
};

/** A parte da qualidade da tela que o seletor do app escolhe. */
export type DesktopShareQuality = {
  resolution: "720p" | "1080p" | "1440p" | "original";
  fps: 15 | 30 | 60;
  systemAudio: boolean;
};

/** O app de desktop tem o seletor completo (fonte + qualidade)? */
export function hasSharePicker(
  d: DesktopBridge | null,
): d is DesktopBridge & Required<Pick<DesktopBridge, "setShareQuality" | "takeShareQuality">> {
  return !!d?.sharePicker && typeof d.setShareQuality === "function" && typeof d.takeShareQuality === "function";
}

export function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const ponte = (window as { blackberryDesktop?: DesktopBridge }).blackberryDesktop;
  return ponte ?? null;
}
