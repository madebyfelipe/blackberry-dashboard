/*
 * Dimensões a partir do cabeçalho do arquivo — sem dependência de imagem.
 *
 * Serve para o editor já mostrar "1080 x 1350" logo após o upload e para
 * escolher o formato provável da peça. Cobre PNG, JPEG, GIF e WebP; o que não
 * for reconhecido volta `undefined` e a peça mantém o tamanho do formato.
 */

export type Dimensions = { width: number; height: number };

export function readDimensions(bytes: Uint8Array): Dimensions | undefined {
  return png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes);
}

function u32be(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

function u16be(b: Uint8Array, at: number): number {
  return (b[at] << 8) | b[at + 1];
}

function u16le(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}

/** PNG: assinatura de 8 bytes + IHDR com largura/altura em big-endian. */
function png(b: Uint8Array): Dimensions | undefined {
  if (b.length < 24) return undefined;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((v, i) => b[i] === v)) return undefined;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** GIF: "GIF87a"/"GIF89a" + largura/altura little-endian. */
function gif(b: Uint8Array): Dimensions | undefined {
  if (b.length < 10) return undefined;
  if (b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return undefined;
  return { width: u16le(b, 6), height: u16le(b, 8) };
}

/** WebP: RIFF....WEBP — variantes VP8, VP8L e VP8X. */
function webp(b: Uint8Array): Dimensions | undefined {
  if (b.length < 30) return undefined;
  const tag = (at: number, text: string) =>
    [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
  if (!tag(0, "RIFF") || !tag(8, "WEBP")) return undefined;

  if (tag(12, "VP8X")) {
    // Canvas size é 24 bits little-endian, menos 1.
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  if (tag(12, "VP8L")) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
    };
  }
  if (tag(12, "VP8 ")) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  return undefined;
}

/**
 * JPEG: percorre os marcadores até um SOFn (0xC0–0xCF, fora de C4/C8/CC), que
 * carrega altura e largura logo depois do tamanho do segmento.
 */
function jpeg(b: Uint8Array): Dimensions | undefined {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = b[at + 1];
    // Preenchimento (0xFF) e marcadores sem payload.
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const length = u16be(b, at + 2);
    const isSOF =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSOF) {
      return { height: u16be(b, at + 5), width: u16be(b, at + 7) };
    }
    if (length < 2) return undefined;
    at += 2 + length;
  }
  return undefined;
}
