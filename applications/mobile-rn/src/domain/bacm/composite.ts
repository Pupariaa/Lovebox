import { AppConfig } from "@/config/AppConfig";
import { blend565 } from "./rgb565";

export function compositeFrameOnBg(
  bg: Uint16Array,
  bgW: number,
  bgH: number,
  frame: Uint16Array,
  frameW: number,
  frameH: number,
  alpha: Uint8Array | null,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  for (let py = 0; py < dh; py++) {
    for (let px = 0; px < dw; px++) {
      const sx = Math.floor((px * frameW) / dw);
      const sy = Math.floor((py * frameH) / dh);
      const fi = sy * frameW + sx;
      if (fi < 0 || fi >= frame.length) continue;
      const a = alpha ? alpha[fi] & 0xff : 255;
      if (a < 8) continue;
      const fg = frame[fi] & 0xffff;
      if (alpha == null && fg === 0) continue;
      const tx = dx + px;
      const ty = dy + py;
      if (tx < 0 || ty < 0 || tx >= bgW || ty >= bgH) continue;
      const bi = ty * bgW + tx;
      if (bi < 0 || bi >= bg.length) continue;
      bg[bi] = a >= 250 ? fg : blend565(bg[bi] & 0xffff, fg, a);
    }
  }
}

export function compositeIconOnBgCopy(
  bg: Uint16Array,
  layerX: number,
  layerY: number,
  side: number,
  frame: Uint16Array,
  frameSide: number,
  alpha: Uint8Array | null,
): Uint16Array {
  const copy = bg.slice();
  compositeFrameOnBg(
    copy,
    AppConfig.MSG_WIDTH,
    AppConfig.MSG_HEIGHT,
    frame,
    frameSide,
    frameSide,
    alpha,
    layerX,
    layerY,
    side,
    side,
  );
  return copy;
}

export function cropRect(
  pixels: Uint16Array,
  srcW: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const si = (y + row) * srcW + (x + col);
      out[row * w + col] = si >= 0 && si < pixels.length ? pixels[si] : 0;
    }
  }
  return out;
}
