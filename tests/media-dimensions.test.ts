import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { readDimensions } from "../src/lib/media/dimensions";

/*
 * Os arquivos são montados aqui, byte a byte: o que o módulo lê é só o
 * cabeçalho, então um arquivo mínimo (e válido no cabeçalho) basta — e o teste
 * não depende de nenhum binário no repositório.
 */

/** PNG: assinatura + chunk IHDR com largura/altura em big-endian. */
function png(width: number, height: number): Uint8Array {
  const b = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return new Uint8Array(b);
}

/** GIF: "GIF89a" + tela lógica em little-endian. */
function gif(width: number, height: number, versao = "GIF89a"): Uint8Array {
  const b = Buffer.alloc(13);
  b.write(versao, 0, "ascii");
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return new Uint8Array(b);
}

/** JPEG: SOI + APP0 (que o leitor precisa pular) + SOF0 com altura/largura. */
function jpeg(width: number, height: number, sof = 0xc0): Uint8Array {
  const app0 = Buffer.alloc(18);
  app0.writeUInt16BE(0xffe0, 0);
  app0.writeUInt16BE(16, 2); // tamanho do segmento, sem contar o marcador
  app0.write("JFIF\0", 4, "ascii");

  const sofSeg = Buffer.alloc(21);
  sofSeg.writeUInt8(0xff, 0);
  sofSeg.writeUInt8(sof, 1);
  sofSeg.writeUInt16BE(17, 2); // tamanho
  sofSeg.writeUInt8(8, 4); // precisão
  sofSeg.writeUInt16BE(height, 5);
  sofSeg.writeUInt16BE(width, 7);
  sofSeg.writeUInt8(3, 9); // componentes

  return new Uint8Array(
    Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sofSeg, Buffer.from([0xff, 0xd9])]),
  );
}

/** WebP estendido (VP8X): tamanho do canvas em 24 bits little-endian, menos 1. */
function webpVP8X(width: number, height: number): Uint8Array {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(22, 4);
  b.write("WEBP", 8, "ascii");
  b.write("VP8X", 12, "ascii");
  b.writeUInt32LE(10, 16);
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return new Uint8Array(b);
}

describe("readDimensions", () => {
  test("PNG", () => {
    assert.deepEqual(readDimensions(png(1080, 1350)), { width: 1080, height: 1350 });
    assert.deepEqual(readDimensions(png(1, 1)), { width: 1, height: 1 });
    assert.deepEqual(readDimensions(png(4096, 2160)), { width: 4096, height: 2160 });
  });

  test("GIF, nas duas versões da assinatura", () => {
    assert.deepEqual(readDimensions(gif(1080, 1920)), { width: 1080, height: 1920 });
    assert.deepEqual(readDimensions(gif(320, 240, "GIF87a")), { width: 320, height: 240 });
    assert.deepEqual(readDimensions(gif(65535, 1)), { width: 65535, height: 1 });
  });

  test("JPEG, pulando o segmento APP0 até o SOF", () => {
    assert.deepEqual(readDimensions(jpeg(1080, 1080)), { width: 1080, height: 1080 });
    assert.deepEqual(readDimensions(jpeg(1920, 1080)), { width: 1920, height: 1080 });
  });

  test("JPEG progressivo (SOF2) também é lido", () => {
    assert.deepEqual(readDimensions(jpeg(800, 600, 0xc2)), { width: 800, height: 600 });
  });

  test("JPEG: marcadores que não carregam tamanho não confundem a leitura", () => {
    // 0xC4 (tabela de Huffman) está na faixa dos SOF mas não é um deles.
    assert.deepEqual(readDimensions(jpeg(640, 480, 0xc4)), undefined);
  });

  test("WebP estendido (VP8X)", () => {
    assert.deepEqual(readDimensions(webpVP8X(1080, 1350)), { width: 1080, height: 1350 });
  });

  test("o formato é escolhido pela assinatura, não pela ordem dos testes", () => {
    // Um GIF não pode ser lido como PNG nem vice-versa.
    assert.deepEqual(readDimensions(gif(100, 200)), { width: 100, height: 200 });
    assert.deepEqual(readDimensions(png(200, 100)), { width: 200, height: 100 });
  });

  test("o que não é imagem conhecida devolve undefined", () => {
    assert.equal(readDimensions(new Uint8Array(0)), undefined);
    assert.equal(readDimensions(new Uint8Array([1, 2, 3])), undefined);
    assert.equal(readDimensions(new Uint8Array(Buffer.from("não sou imagem nenhuma, só texto"))), undefined);
  });

  test("arquivo truncado não lê lixo nem lança", () => {
    assert.equal(readDimensions(png(1080, 1350).slice(0, 20)), undefined);
    assert.equal(readDimensions(gif(1080, 1920).slice(0, 8)), undefined);
    assert.equal(readDimensions(webpVP8X(1080, 1350).slice(0, 25)), undefined);
  });
});
