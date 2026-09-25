import { WAVEFORM_BARS, peaksOf, type VoiceMeta } from "@/lib/inbox/voice";

/*
 * Mede um áudio no navegador: duração e as barras da forma de onda. Roda em
 * quem manda, antes de subir — o resultado vai junto no registro do anexo, e
 * quem ouve recebe o desenho pronto.
 *
 * Duas razões para medir aqui e não confiar no `<audio>`: o WebM que o
 * gravador do Chrome produz chega sem duração no cabeçalho (o elemento diz
 * `Infinity` até tocar inteiro), e a forma de onda precisa das amostras, que
 * só a decodificação dá.
 *
 * A decodificação é num `OfflineAudioContext` a 8 kHz: é mais que o bastante
 * para achar os picos de 56 barras e ocupa uma fração da memória de decodificar
 * na taxa do arquivo. Tudo aqui é "se der": falhou, a mensagem vai sem desenho.
 */

/** Acima disso nem tenta — decodificar um arquivo de áudio grande trava a aba. */
const ANALYZE_MAX_BYTES = 12 * 1024 * 1024;

const SAMPLE_RATE = 8000;

export async function analyzeAudio(data: Blob | ArrayBuffer): Promise<VoiceMeta> {
  try {
    const size = data instanceof Blob ? data.size : data.byteLength;
    if (!size || size > ANALYZE_MAX_BYTES) return {};
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const Ctx =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx) return {};
    let ctx: OfflineAudioContext;
    try {
      ctx = new Ctx(1, 1, SAMPLE_RATE);
    } catch {
      // Safari antigo recusa taxas baixas; 22,05 kHz é o piso que todo mundo aceita.
      ctx = new Ctx(1, 1, 22050);
    }
    const audio = await ctx.decodeAudioData(buffer);
    return {
      duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined,
      waveform: peaksOf(mixdown(audio), WAVEFORM_BARS),
    };
  } catch {
    return {};
  }
}

/** Um canal só: o pico de cada instante entre os canais que houver. */
function mixdown(audio: AudioBuffer): Float32Array {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > out[i]) out[i] = v;
    }
  }
  return out;
}

/*
 * A mensagem de voz que chegou antes de existir o desenho (ou de um navegador
 * que não conseguiu medir) é medida por quem ouve, uma vez por endereço.
 */
const measured = new Map<string, Promise<VoiceMeta>>();

export function measureRemoteAudio(url: string, size: number): Promise<VoiceMeta> {
  if (!size || size > ANALYZE_MAX_BYTES) return Promise.resolve({});
  let pending = measured.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then(analyzeAudio)
      .catch(() => ({}));
    measured.set(url, pending);
  }
  return pending;
}
