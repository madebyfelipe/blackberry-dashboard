import type { AlertSound } from "@/lib/inbox/notifyPrefs";

/*
 * Os sons do aviso, sintetizados na hora pelo Web Audio — nada de arquivo
 * para baixar nem direito autoral para cuidar. Cada um é curto (menos de meio
 * segundo) e baixo: é um toque, não um alarme.
 *
 * O navegador só deixa tocar som depois de um gesto na página. Aviso que
 * chega antes do primeiro clique sai calado — é a regra dele, não um defeito.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx ??= new Ctx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Um tom com ataque rápido e queda exponencial — a base dos três sons. */
function tone(
  ac: AudioContext,
  at: number,
  { freq, to, dur, gain, type = "sine" }: { freq: number; to?: number; dur: number; gain: number; type?: OscillatorType },
) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.6);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

let wav: HTMLAudioElement | null = null;

export function playAlertSound(sound: AlertSound): void {
  if (sound === "nenhum") return;
  if (sound === "blackberry") {
    try {
      wav ??= new Audio("/sounds/notificacao.wav");
      wav.volume = 0.6;
      wav.currentTime = 0;
      void wav.play().catch(() => undefined);
    } catch {
      // Sem áudio no ambiente: segue calado.
    }
    return;
  }
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  if (sound === "gota") {
    // Uma gota: o tom sobe rápido e some.
    tone(ac, t, { freq: 520, to: 1250, dur: 0.22, gain: 0.18 });
  } else if (sound === "sino") {
    // Duas notas em quinta, com o harmônico de sino por cima.
    tone(ac, t, { freq: 880, dur: 0.45, gain: 0.12 });
    tone(ac, t, { freq: 2640, dur: 0.25, gain: 0.03 });
    tone(ac, t + 0.12, { freq: 1318.5, dur: 0.4, gain: 0.1 });
  } else {
    // Estalo: um clique seco e grave.
    tone(ac, t, { freq: 180, to: 90, dur: 0.07, gain: 0.3, type: "triangle" });
  }
}
