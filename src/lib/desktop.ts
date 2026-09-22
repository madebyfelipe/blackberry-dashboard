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
};

export function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const ponte = (window as { blackberryDesktop?: DesktopBridge }).blackberryDesktop;
  return ponte ?? null;
}
