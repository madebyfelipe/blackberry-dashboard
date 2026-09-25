"use strict";

/*
 * A qualidade da tela compartilhada escolhida no seletor (resolução,
 * quadros, som do sistema). O seletor e a página são processos diferentes
 * do principal, então o que chega deles passa por aqui antes de ser usado:
 * só os valores da régua do app web (`src/lib/inbox/screenQuality.ts`).
 */

const RESOLUCOES = ["720p", "1080p", "1440p", "original"];
const QUADROS = [15, 30, 60];

/** O padrão do app web, para quando a página ainda não disse nada. */
const PADRAO = { resolution: "1080p", fps: 30, systemAudio: true };

/**
 * @param {unknown} raw
 * @returns {{ resolution: string, fps: number, systemAudio: boolean } | null}
 */
function normalizarQualidade(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const resolution = RESOLUCOES.includes(/** @type {string} */ (r.resolution)) ? r.resolution : PADRAO.resolution;
  const fps = QUADROS.includes(Number(r.fps)) ? Number(r.fps) : PADRAO.fps;
  const systemAudio = typeof r.systemAudio === "boolean" ? r.systemAudio : PADRAO.systemAudio;
  return { resolution: /** @type {string} */ (resolution), fps, systemAudio };
}

module.exports = { normalizarQualidade, PADRAO, RESOLUCOES, QUADROS };
