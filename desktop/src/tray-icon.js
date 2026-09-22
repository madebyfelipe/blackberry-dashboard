"use strict";

/*
 * Ícone da bandeja — PROVISÓRIO (🎨 no ROADMAP). O black berry ainda não tem
 * marca desenhada além do nome escrito, e ícone é desenho do Felipe: até ele
 * existir, a bandeja mostra um círculo cheio, gerado aqui, sem arquivo de
 * imagem nenhum no repositório. Quando o ícone chegar, troca-se esta função
 * por um `nativeImage.createFromPath` e nada mais muda.
 */

const zlib = require("node:zlib");

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * PNG RGBA de `size`×`size` com um círculo branco cheio e borda suavizada.
 * Branco puro com alfa é o que o macOS pede num "template image" (ele pinta
 * de preto ou branco conforme o tema da barra de menus).
 */
function circlePng(size) {
  const raio = size / 2 - 1;
  const centro = size / 2;
  const linhas = [];
  for (let y = 0; y < size; y++) {
    const linha = Buffer.alloc(1 + size * 4); // byte 0: filtro "nenhum"
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - centro, y + 0.5 - centro);
      const alfa = Math.max(0, Math.min(1, raio - d + 0.5));
      linha.writeUInt32BE((0xffffff00 | Math.round(alfa * 255)) >>> 0, 1 + x * 4);
    }
    linhas.push(linha);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(linhas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { circlePng };
