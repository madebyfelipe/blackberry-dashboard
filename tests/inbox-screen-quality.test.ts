import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCREEN_QUALITY,
  parseScreenQuality,
  screenBitrate,
  screenShareOptions,
} from "../src/lib/inbox/screenQuality";

test("qualidade da tela: a escolha vira captura, dica e codificação", () => {
  const o = screenShareOptions({ resolution: "720p", fps: 60, optimize: "fluidez" });
  assert.deepEqual(o.capture.resolution, { width: 1280, height: 720, frameRate: 60 });
  assert.equal(o.capture.contentHint, "motion");
  assert.equal(o.publish.screenShareEncoding.maxFramerate, 60);
  assert.equal(o.publish.degradationPreference, "maintain-framerate");
  assert.deepEqual(o.constraints.frameRate, { max: 60 });
});

test("qualidade da tela: nitidez guarda resolução e gasta mais bits por pixel", () => {
  const nitida = { resolution: "1080p", fps: 30, optimize: "nitidez" } as const;
  const fluida = { ...nitida, optimize: "fluidez" } as const;
  assert.ok(screenBitrate(nitida) > screenBitrate(fluida));
  assert.equal(screenShareOptions(nitida).publish.degradationPreference, "maintain-resolution");
});

test("qualidade da tela: a banda tem piso e teto", () => {
  assert.equal(screenBitrate({ resolution: "720p", fps: 15, optimize: "fluidez" }), 1_000_000);
  assert.equal(screenBitrate({ resolution: "original", fps: 60, optimize: "nitidez" }), 12_000_000);
});

test("qualidade da tela: preferência guardada estranha volta ao padrão", () => {
  assert.deepEqual(parseScreenQuality(null), DEFAULT_SCREEN_QUALITY);
  assert.deepEqual(parseScreenQuality({ resolution: "8k", fps: 144, optimize: "x" }), DEFAULT_SCREEN_QUALITY);
  assert.deepEqual(parseScreenQuality({ resolution: "1440p", fps: 60, optimize: "fluidez" }), {
    resolution: "1440p",
    fps: 60,
    optimize: "fluidez",
  });
});
