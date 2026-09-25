import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CAMERA_PREFS,
  cameraCapture,
  cameraEffects,
  decodeReaction,
  encodeReaction,
  parseCameraPrefs,
  supportsEffect,
} from "../src/lib/inbox/callPrefs";

test("câmera: a resolução escolhida vira a captura", () => {
  assert.deepEqual(cameraCapture({ ...DEFAULT_CAMERA_PREFS, resolution: "1080p", deviceId: "cam-2" }), {
    deviceId: "cam-2",
    resolution: { width: 1920, height: 1080, frameRate: 30 },
  });
  assert.equal(cameraCapture(DEFAULT_CAMERA_PREFS).deviceId, undefined, "sem escolha: a padrão do sistema");
});

test("câmera: efeito só vai para a faixa quando o aparelho anuncia", () => {
  const prefs = { ...DEFAULT_CAMERA_PREFS, blur: true, lighting: true };
  assert.deepEqual(cameraEffects(prefs, {}), {});
  assert.deepEqual(cameraEffects(prefs, { backgroundBlur: [false, true] }), { backgroundBlur: true });
  assert.equal(supportsEffect({ backgroundBlur: [false, true] }, "blur"), true);
  assert.equal(supportsEffect({ backgroundBlur: [false] }, "blur"), false, "anunciado, mas só desligado");
  assert.equal(supportsEffect(null, "lighting"), false);
});

test("câmera: preferência guardada estranha volta ao padrão", () => {
  assert.deepEqual(parseCameraPrefs("x"), DEFAULT_CAMERA_PREFS);
  assert.deepEqual(parseCameraPrefs({ resolution: "4k", mirror: "sim", deviceId: 3 }), DEFAULT_CAMERA_PREFS);
  assert.equal(parseCameraPrefs({ mirror: false }).mirror, false);
});

test("reação: vai e volta pelo canal de dados; o desconhecido é ignorado", () => {
  assert.equal(decodeReaction(encodeReaction("🎉")), "🎉");
  const estranho = new TextEncoder().encode(JSON.stringify({ tipo: "reacao", emoji: "<script>" }));
  assert.equal(decodeReaction(estranho), null);
  assert.equal(decodeReaction(new TextEncoder().encode("não é json")), null);
  assert.equal(decodeReaction(new TextEncoder().encode(JSON.stringify({ tipo: "outro", emoji: "👍" }))), null);
});
