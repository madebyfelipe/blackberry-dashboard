/*
 * Microfone, saída de som e "Reduzir ruído" escolhidos em Configurações ›
 * Pessoal › Chamada e áudio. São do **aparelho** (o id de um microfone só
 * existe neste computador), então moram no navegador, como a câmera
 * (`callPrefs.ts`) e a tela compartilhada (`screenQuality.ts`). A chamada
 * começa com eles e grava de volta o que for trocado lá dentro.
 */

export type AudioPrefs = {
  /** `null` = o microfone padrão do sistema. */
  inputId: string | null;
  /** `null` = a saída padrão do sistema. */
  outputId: string | null;
  noiseSuppression: boolean;
};

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  inputId: null,
  outputId: null,
  noiseSuppression: true,
};

const KEY = "bb:audio";

export function parseAudioPrefs(raw: unknown): AudioPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AudioPrefs>;
  const id = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 200) : null);
  return {
    inputId: id(r.inputId),
    outputId: id(r.outputId),
    noiseSuppression: typeof r.noiseSuppression === "boolean" ? r.noiseSuppression : true,
  };
}

export function loadAudioPrefs(): AudioPrefs {
  try {
    return parseAudioPrefs(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

export function saveAudioPrefs(p: AudioPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Navegador sem armazenamento (aba anônima cheia): vale só para esta visita.
  }
}
