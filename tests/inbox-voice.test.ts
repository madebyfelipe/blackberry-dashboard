import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  BAR_MAX_PX,
  BAR_MIN_PX,
  WAVEFORM_BARS,
  barHeight,
  formatClock,
  nextRate,
  peaksOf,
  rateLabel,
  resampleWaveform,
  voiceMeta,
} from "../src/lib/inbox/voice";

describe("o que o navegador manda da mensagem de voz", () => {
  test("duração e barras boas passam — a duração em décimos", () => {
    assert.deepEqual(voiceMeta({ duration: 42.37, waveform: [0, 50, 100] }), {
      duration: 42.4,
      waveform: [0, 50, 100],
    });
  });

  test("no multipart as barras chegam como JSON e a duração como texto", () => {
    assert.deepEqual(voiceMeta({ duration: "3.2", waveform: "[10,20]" }), {
      duration: 3.2,
      waveform: [10, 20],
    });
  });

  test("barras fora da escala são presas a 0–100 e arredondadas", () => {
    assert.deepEqual(voiceMeta({ waveform: [-5, 12.6, 250] }).waveform, [0, 13, 100]);
  });

  test("o resto some sem erro", () => {
    assert.deepEqual(voiceMeta({}), {});
    assert.deepEqual(voiceMeta({ duration: null, waveform: null }), {});
    assert.deepEqual(voiceMeta({ duration: Infinity }), {});
    assert.deepEqual(voiceMeta({ duration: -1 }), {});
    assert.deepEqual(voiceMeta({ duration: 99_999 }), {});
    assert.deepEqual(voiceMeta({ waveform: "não é json" }), {});
    assert.deepEqual(voiceMeta({ waveform: [1, "x", 3] }), {});
    assert.deepEqual(voiceMeta({ waveform: [] }), {});
    assert.deepEqual(voiceMeta({ waveform: new Array(WAVEFORM_BARS + 1).fill(1) }), {});
    assert.deepEqual(voiceMeta({ waveform: { length: 2 } }), {});
  });
});

describe("as barras na tela", () => {
  test("na largura do desenho, ficam como estão", () => {
    const bars = [1, 2, 3, 4];
    assert.equal(resampleWaveform(bars, 4), bars);
  });

  test("apertando, cada barra nova leva o pico do trecho que cobre", () => {
    assert.deepEqual(resampleWaveform([10, 90, 20, 30, 80, 5], 3), [90, 30, 80]);
    assert.deepEqual(resampleWaveform([10, 90, 20, 30, 80, 5], 2), [90, 80]);
  });

  test("esticando, repete em vez de inventar", () => {
    assert.deepEqual(resampleWaveform([10, 90], 4), [10, 10, 90, 90]);
  });

  test("nada para desenhar, nada desenhado", () => {
    assert.deepEqual(resampleWaveform([], 10), []);
    assert.deepEqual(resampleWaveform([1, 2], 0), []);
  });

  test("a altura vai de 4 a 28 px, como no desenho", () => {
    assert.equal(barHeight(0), BAR_MIN_PX);
    assert.equal(barHeight(100), BAR_MAX_PX);
    assert.equal(barHeight(50), 16);
    assert.equal(barHeight(-10), BAR_MIN_PX);
    assert.equal(barHeight(1000), BAR_MAX_PX);
  });
});

describe("a forma de onda de um sinal", () => {
  test("o pico mais alto vira 100, o negativo conta, e a raiz abre o meio", () => {
    const s = new Float32Array([0, 0.5, 0, -1, 0, 0.25, 0, 0]);
    assert.deepEqual(peaksOf(s, 4), [71, 100, 50, 0]);
  });

  test("silêncio é tudo zero, sem dividir por zero", () => {
    assert.deepEqual(peaksOf(new Float32Array(100), 5), [0, 0, 0, 0, 0]);
  });

  test("sempre as barras pedidas", () => {
    assert.equal(peaksOf(new Float32Array(1000).fill(0.3), WAVEFORM_BARS).length, WAVEFORM_BARS);
  });
});

describe("relógio e velocidade", () => {
  test("m:ss", () => {
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(16.9), "0:16");
    assert.equal(formatClock(42), "0:42");
    assert.equal(formatClock(3725), "62:05");
    assert.equal(formatClock(Infinity), "0:00");
    assert.equal(formatClock(NaN), "0:00");
  });

  test("1× → 1.5× → 2× → 1×", () => {
    assert.equal(nextRate(1), 1.5);
    assert.equal(nextRate(1.5), 2);
    assert.equal(nextRate(2), 1);
    assert.equal(rateLabel(1.5), "1.5×");
  });
});
