"use strict";

/*
 * As regras de segurança da janela, fora do Electron para poderem ser
 * testadas com `node --test`. O `main.js` só as aplica.
 *
 * A janela carrega um site remoto (o black berry publicado), então tudo que
 * ela pode fazer é recortado pela origem dele: só essa origem navega dentro
 * do app, só ela ganha microfone/câmera/tela, e qualquer outro endereço sai
 * para o navegador do sistema.
 */

/**
 * De onde a janela carrega o black berry. `BLACKBERRY_URL` (variável de
 * ambiente) ganha de `package.json → blackberry.url`, então dá para apontar o
 * mesmo app para `localhost` ou para um preview da Vercel sem rebuild.
 * Devolve só a origem (`https://host[:porta]`), ou `null` se não houver
 * endereço válido — `http` só é aceito em localhost.
 */
function resolveAppOrigin(envUrl, configUrl) {
  const bruto = (envUrl || configUrl || "").trim();
  if (!bruto) return null;
  let url;
  try {
    url = new URL(bruto);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:" || (url.protocol === "http:" && local)) {
    return url.origin;
  }
  return null;
}

/** O endereço é do próprio black berry (mesma origem, byte a byte)? */
function isAppUrl(raw, appOrigin) {
  try {
    return new URL(raw).origin === appOrigin;
  } catch {
    return false;
  }
}

/**
 * Endereço de fora que pode ir para o navegador/app do sistema. Só esquemas
 * que abrem página ou e-mail — `file:`, `javascript:` e protocolos de app
 * arbitrários nunca passam por `shell.openExternal`.
 */
function canOpenExternally(raw) {
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

/**
 * Permissões que o black berry usa: microfone e câmera (`media`), tela
 * compartilhada, notificações, tela cheia do vídeo e escrever na área de
 * transferência (o "copiar link"). O resto — localização, MIDI, USB, HID… —
 * é recusado sem perguntar.
 */
const PERMISSOES = new Set([
  "media",
  "display-capture",
  "notifications",
  "fullscreen",
  "clipboard-sanitized-write",
  "speaker-selection",
]);

function allowsPermission(permission, requestingUrl, appOrigin) {
  return PERMISSOES.has(permission) && isAppUrl(requestingUrl, appOrigin);
}

module.exports = { resolveAppOrigin, isAppUrl, canOpenExternally, allowsPermission };
