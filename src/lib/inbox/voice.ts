/*
 * O desenho da mensagem de voz (export "Msg · Áudio"): 56 barras de 3px que
 * vão de 4 a 28px de altura, dentro de uma faixa de 30px. A forma de onda sai
 * do próprio arquivo, no navegador de quem manda (`audioAnalysis.ts`), e vem
 * junto no registro do anexo — é só um punhado de números, e poupa quem ouve
 * de baixar e decodificar o áudio inteiro só para desenhar as barras.
 *
 * Aqui mora o que as duas pontas precisam concordar: quantas barras, a
 * escala, e a faxina do que chega do navegador (o servidor não confia em
 * número nenhum que não passou por `voiceMeta`).
 */

/** Quantas barras a mensagem guarda — as 56 do desenho. */
export const WAVEFORM_BARS = 56;

/** A escala de cada barra: 0 (silêncio) a 100 (o pico do áudio). */
export const WAVEFORM_MAX = 100;

/** As alturas do desenho, em px: a barra mais baixa e a mais alta. */
export const BAR_MIN_PX = 4;
export const BAR_MAX_PX = 28;

/** Uma hora é muito mais que os 5 minutos do gravador — é só o teto do absurdo. */
const DURATION_MAX_SECONDS = 60 * 60;

/** Duração (s) e barras de um áudio, como o anexo guarda. */
export type VoiceMeta = { duration?: number; waveform?: number[] };

/**
 * O que o navegador mandou, limpo: duração finita e positiva (em décimos de
 * segundo), barras inteiras de 0 a 100, no máximo `WAVEFORM_BARS`. O que não
 * passa some sem erro — a mensagem de voz toca do mesmo jeito, só sem o
 * desenho.
 */
export function voiceMeta(input: { duration?: unknown; waveform?: unknown }): VoiceMeta {
  const out: VoiceMeta = {};
  const d = Number(input.duration);
  if (input.duration != null && Number.isFinite(d) && d > 0 && d <= DURATION_MAX_SECONDS) {
    out.duration = Math.round(d * 10) / 10;
  }
  const raw = typeof input.waveform === "string" ? parseJson(input.waveform) : input.waveform;
  if (Array.isArray(raw) && raw.length > 0 && raw.length <= WAVEFORM_BARS) {
    const bars = raw.map(Number);
    if (bars.every(Number.isFinite)) {
      out.waveform = bars.map((v) => Math.min(WAVEFORM_MAX, Math.max(0, Math.round(v))));
    }
  }
  return out;
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * As barras redistribuídas em `count` — para caber numa tela mais estreita
 * que o desenho. Cada barra nova fica com o pico do trecho que ela cobre:
 * a média apagaria justamente as sílabas que dão forma à fala.
 */
export function resampleWaveform(bars: number[], count: number): number[] {
  if (count <= 0 || bars.length === 0) return [];
  if (bars.length === count) return bars;
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * bars.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * bars.length) / count));
    let peak = 0;
    for (let j = from; j < to && j < bars.length; j++) peak = Math.max(peak, bars[j]);
    return peak;
  });
}

/** A altura em px de uma barra de 0 a 100 — entre a mínima e a máxima do desenho. */
export function barHeight(value: number): number {
  const v = Math.min(WAVEFORM_MAX, Math.max(0, value)) / WAVEFORM_MAX;
  return Math.round(BAR_MIN_PX + v * (BAR_MAX_PX - BAR_MIN_PX));
}

/**
 * Picos de um sinal em `count` barras de 0 a 100, já normalizados pelo maior
 * — uma fala baixa ainda desenha uma onda legível. A raiz quadrada abre os
 * trechos médios, como o ouvido percebe (sem ela, fora o grito mais alto,
 * tudo vira fiapo).
 */
export function peaksOf(samples: Float32Array, count: number): number[] {
  if (count <= 0) return [];
  const peaks = new Array<number>(count).fill(0);
  const per = samples.length / count;
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * per);
    const to = Math.min(samples.length, Math.floor((i + 1) * per));
    let peak = 0;
    for (let j = from; j < to; j++) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    peaks[i] = peak;
  }
  const top = Math.max(...peaks);
  if (!(top > 0)) return peaks.map(() => 0);
  return peaks.map((p) => Math.round(Math.sqrt(p / top) * WAVEFORM_MAX));
}

/** 42 → "0:42"; 3725 → "62:05". O relógio da mensagem de voz. */
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** As velocidades do selo, na ordem em que o toque passa por elas. */
export const PLAYBACK_RATES = [1, 1.5, 2] as const;

export function nextRate(rate: number): number {
  const at = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
  return PLAYBACK_RATES[(at + 1) % PLAYBACK_RATES.length];
}

/** 1 → "1×"; 1.5 → "1.5×" — como está no desenho. */
export function rateLabel(rate: number): string {
  return `${rate}×`;
}
