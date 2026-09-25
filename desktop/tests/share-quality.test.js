"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizarQualidade } = require("../src/share-quality");

test("qualidade válida passa como veio", () => {
  assert.deepEqual(normalizarQualidade({ resolution: "1440p", fps: 60, systemAudio: false }), {
    resolution: "1440p",
    fps: 60,
    systemAudio: false,
  });
});

test("valor fora da régua vira o padrão, o resto fica", () => {
  assert.deepEqual(normalizarQualidade({ resolution: "8k", fps: "60", systemAudio: "sim" }), {
    resolution: "1080p",
    fps: 60,
    systemAudio: true,
  });
});

test("nada ou lixo: sem qualidade", () => {
  assert.equal(normalizarQualidade(null), null);
  assert.equal(normalizarQualidade("1080p"), null);
});
