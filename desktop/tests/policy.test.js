"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  allowsPermission,
  canOpenExternally,
  isAppUrl,
  resolveAppOrigin,
} = require("../src/policy");
const { circlePng } = require("../src/tray-icon");

const APP = "https://app.exemplo.com.br";

test("endereço do app: variável de ambiente ganha do package.json", () => {
  assert.equal(resolveAppOrigin("https://preview.vercel.app/x", APP), "https://preview.vercel.app");
  assert.equal(resolveAppOrigin("", `${APP}/inbox`), APP);
  assert.equal(resolveAppOrigin(undefined, "  "), null);
});

test("endereço do app: http só em localhost, e nada que não seja web", () => {
  assert.equal(resolveAppOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(resolveAppOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(resolveAppOrigin("http://app.exemplo.com.br"), null);
  assert.equal(resolveAppOrigin("file:///etc/passwd"), null);
  assert.equal(resolveAppOrigin("não é url"), null);
});

test("origem do app: igual byte a byte, sem subdomínio nem porta diferente", () => {
  assert.equal(isAppUrl(`${APP}/inbox?c=1`, APP), true);
  assert.equal(isAppUrl("https://app.exemplo.com.br.golpe.com/", APP), false);
  assert.equal(isAppUrl("https://outro.exemplo.com.br/", APP), false);
  assert.equal(isAppUrl("https://app.exemplo.com.br:8443/", APP), false);
  assert.equal(isAppUrl("http://app.exemplo.com.br/", APP), false);
  assert.equal(isAppUrl("", APP), false);
});

test("abrir fora: só página e e-mail", () => {
  assert.equal(canOpenExternally("https://wa.me/5511999999999"), true);
  assert.equal(canOpenExternally("mailto:cliente@exemplo.com"), true);
  assert.equal(canOpenExternally("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(canOpenExternally("javascript:alert(1)"), false);
  assert.equal(canOpenExternally("ms-settings:privacy"), false);
});

test("permissões: só as que o black berry usa, só para a origem dele", () => {
  assert.equal(allowsPermission("media", `${APP}/inbox`, APP), true);
  assert.equal(allowsPermission("display-capture", APP, APP), true);
  assert.equal(allowsPermission("notifications", APP, APP), true);
  assert.equal(allowsPermission("geolocation", APP, APP), false);
  assert.equal(allowsPermission("hid", APP, APP), false);
  assert.equal(allowsPermission("media", "https://golpe.com/", APP), false);
});

test("ícone provisório da bandeja é um PNG válido do tamanho pedido", () => {
  const png = circlePng(32);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
});
