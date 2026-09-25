import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCREEN_QUALITY,
  effectiveBitrate,
  parseScreenQuality,
  screenBitrate,
  screenShareOptions,
  type ScreenQuality,
} from "../src/lib/inbox/screenQuality";

const q = (over: Partial<ScreenQuality>): ScreenQuality => ({ ...DEFAULT_SCREEN_QUALITY, ...over });

test("qualidade da tela: a escolha vira captura, dica e codificação", () => {
  const o = screenShareOptions(q({ resolution: "720p", fps: 60, optimize: "fluidez" }));
  assert.deepEqual(o.capture.resolution, { width: 1280, height: 720, frameRate: 60 });
  assert.equal(o.capture.contentHint, "motion");
  assert.equal(o.publish.screenShareEncoding.maxFramerate, 60);
  assert.equal(o.publish.degradationPreference, "maintain-framerate");
  assert.deepEqual(o.constraints.frameRate, { max: 60 });
});

test("qualidade da tela: nitidez guarda resolução e gasta mais bits por pixel", () => {
  const nitida = q({ resolution: "1080p", fps: 30, optimize: "nitidez" });
  const fluida = q({ ...nitida, optimize: "fluidez" });
  assert.ok(screenBitrate(nitida) > screenBitrate(fluida));
  assert.equal(screenShareOptions(nitida).publish.degradationPreference, "maintain-resolution");
});

test("qualidade da tela: a banda tem piso e teto", () => {
  assert.equal(screenBitrate(q({ resolution: "720p", fps: 15, optimize: "fluidez" })), 1_000_000);
  assert.equal(screenBitrate(q({ resolution: "original", fps: 60, optimize: "nitidez" })), 12_000_000);
});

test("qualidade da tela: preferência guardada estranha volta ao padrão", () => {
  assert.deepEqual(parseScreenQuality(null), DEFAULT_SCREEN_QUALITY);
  assert.deepEqual(parseScreenQuality({ resolution: "8k", fps: 144, optimize: "x" }), DEFAULT_SCREEN_QUALITY);
  assert.deepEqual(parseScreenQuality({ resolution: "1440p", fps: 60, optimize: "fluidez" }), {
    ...DEFAULT_SCREEN_QUALITY,
    resolution: "1440p",
    fps: 60,
    optimize: "fluidez",
  });
  assert.deepEqual(
    parseScreenQuality({ ...DEFAULT_SCREEN_QUALITY, bitrateMbps: 99, surface: "tv", systemAudio: "sim" }),
    DEFAULT_SCREEN_QUALITY,
  );
});

test("qualidade da tela: o bitrate escolhido vence o automático, dentro da régua", () => {
  assert.equal(effectiveBitrate(q({ bitrateMbps: 8 })), 8_000_000);
  assert.equal(effectiveBitrate(q({ bitrateMbps: 40 })), 12_000_000);
  assert.equal(effectiveBitrate(q({ bitrateMbps: null })), screenBitrate(q({})));
  assert.equal(screenShareOptions(q({ bitrateMbps: 5 })).publish.screenShareEncoding.maxBitrate, 5_000_000);
});

test("qualidade da tela: a aba do modal e o som do sistema chegam ao navegador", () => {
  const o = screenShareOptions(q({ surface: "window", systemAudio: false }));
  assert.deepEqual(o.capture.video, { displaySurface: "window" });
  assert.equal(o.capture.audio, false);
  assert.equal(o.capture.systemAudio, "exclude");
});
