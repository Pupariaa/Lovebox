import { rgb888To565 } from "./rgb565";

export type IconFrameData = {
  pixels: Uint16Array;
  side: number;
  alpha: Uint8Array | null;
};

export const MAX_FRAMES = 24;

export function sampleFrameIndices(count: number): number[] {
  if (count <= MAX_FRAMES) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const out: number[] = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    out.push(Math.round((i * (count - 1)) / (MAX_FRAMES - 1)));
  }
  return out;
}

export function frameFromRgba(
  src: Uint8Array | Uint8ClampedArray,
  srcW: number,
  srcH: number,
  size: number,
): IconFrameData {
  const pixels = new Uint16Array(size * size);
  const alpha = new Uint8Array(size * size);
  const scale = Math.min(size / srcW, size / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const offX = (size - dw) / 2;
  const offY = (size - dh) / 2;

  for (let y = 0; y < size; y++) {
    const fyf = (y + 0.5 - offY) / scale - 0.5;
    for (let x = 0; x < size; x++) {
      const fxf = (x + 0.5 - offX) / scale - 0.5;
      if (fxf < -0.5 || fyf < -0.5 || fxf > srcW - 0.5 || fyf > srcH - 0.5) {
        continue;
      }
      const x0 = Math.floor(fxf);
      const y0 = Math.floor(fyf);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const cx0 = Math.max(0, x0);
      const cy0 = Math.max(0, y0);
      const wx = fxf - x0;
      const wy = fyf - y0;
      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      const row0 = cy0 * srcW;
      const row1 = y1 * srcW;
      const o00 = (row0 + cx0) * 4;
      const o10 = (row0 + x1) * 4;
      const o01 = (row1 + cx0) * 4;
      const o11 = (row1 + x1) * 4;

      const a00 = src[o00 + 3];
      const a10 = src[o10 + 3];
      const a01 = src[o01 + 3];
      const a11 = src[o11 + 3];
      const aAcc = w00 * a00 + w10 * a10 + w01 * a01 + w11 * a11;
      const outA = Math.round(aAcc);
      if (outA < 4) continue;
      const idx = y * size + x;
      alpha[idx] = outA > 255 ? 255 : outA;
      const rAcc = w00 * a00 * src[o00] + w10 * a10 * src[o10] + w01 * a01 * src[o01] + w11 * a11 * src[o11];
      const gAcc = w00 * a00 * src[o00 + 1] + w10 * a10 * src[o10 + 1] + w01 * a01 * src[o01 + 1] + w11 * a11 * src[o11 + 1];
      const bAcc = w00 * a00 * src[o00 + 2] + w10 * a10 * src[o10 + 2] + w01 * a01 * src[o01 + 2] + w11 * a11 * src[o11 + 2];
      pixels[idx] = rgb888To565(
        Math.round(rAcc / aAcc),
        Math.round(gAcc / aAcc),
        Math.round(bAcc / aAcc),
      );
    }
  }
  return { pixels, side: size, alpha };
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    table[BASE64_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();

export function base64ToBytes(base64: string): Uint8Array {
  let cleanLength = base64.length;
  while (cleanLength > 0 && base64[cleanLength - 1] === "=") cleanLength--;
  const byteLength = Math.floor((cleanLength * 3) / 4);
  const bytes = new Uint8Array(byteLength);
  let bytePos = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < base64.length; i++) {
    const value = LOOKUP[base64.charCodeAt(i)];
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[bytePos++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

export function decodeRgb565(bytes: Uint8Array): { pixels: Uint16Array; side: number } {
  const side = Math.max(1, Math.floor(Math.sqrt(bytes.length / 2)));
  const pixels = new Uint16Array(side * side);
  let i = 0;
  let j = 0;
  while (j < pixels.length && i + 1 < bytes.length) {
    pixels[j] = (bytes[i] | (bytes[i + 1] << 8)) & 0xffff;
    i += 2;
    j++;
  }
  return { pixels, side };
}

export function resizeFrame(
  src: Uint16Array,
  srcSide: number,
  alpha: Uint8Array | null,
  targetSize: number,
): IconFrameData {
  if (srcSide === targetSize) {
    return { pixels: src, side: srcSide, alpha };
  }
  const out = new Uint16Array(targetSize * targetSize);
  const outAlpha = alpha ? new Uint8Array(targetSize * targetSize) : null;
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const sx = Math.floor((x * srcSide) / targetSize);
      const sy = Math.floor((y * srcSide) / targetSize);
      const si = sy * srcSide + sx;
      out[y * targetSize + x] = src[si];
      if (outAlpha && alpha) outAlpha[y * targetSize + x] = alpha[si];
    }
  }
  return { pixels: out, side: targetSize, alpha: outAlpha };
}
