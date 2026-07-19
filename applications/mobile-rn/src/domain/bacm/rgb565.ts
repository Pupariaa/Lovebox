export function rgb888To565(r: number, g: number, b: number): number {
  return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
}

export function hexTo565(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return rgb888To565(r, g, b);
}

export function blend565(bg: number, fg: number, alpha: number): number {
  const a = Math.max(0, Math.min(255, alpha));
  const inv = 255 - a;
  const br = (bg >> 11) & 0x1f;
  const bgG = (bg >> 5) & 0x3f;
  const bb = bg & 0x1f;
  const fr = (fg >> 11) & 0x1f;
  const fgG = (fg >> 5) & 0x3f;
  const fb = fg & 0x1f;
  const r = Math.floor((br * inv + fr * a) / 255);
  const g = Math.floor((bgG * inv + fgG * a) / 255);
  const b = Math.floor((bb * inv + fb * a) / 255);
  return (r << 11) | (g << 5) | b;
}

export function color565To888(value: number): { r: number; g: number; b: number } {
  const r5 = (value >> 11) & 0x1f;
  const g6 = (value >> 5) & 0x3f;
  const b5 = value & 0x1f;
  return {
    r: (r5 << 3) | (r5 >> 2),
    g: (g6 << 2) | (g6 >> 4),
    b: (b5 << 3) | (b5 >> 2),
  };
}

export function rgba8888To565(rgba: Uint8Array, pixelCount: number): Uint16Array {
  const out = new Uint16Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    out[i] = rgb888To565(rgba[o], rgba[o + 1], rgba[o + 2]);
  }
  return out;
}

// Floyd-Steinberg dithered quantization of an opaque RGBA buffer to RGB565. Used for full-frame
// photo backgrounds to remove 16-bit banding on gradients.
export function ditherRgba8888To565(
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint16Array {
  const n = width * height;
  const out = new Uint16Array(n);
  const rBuf = new Float32Array(n);
  const gBuf = new Float32Array(n);
  const bBuf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    rBuf[i] = rgba[o];
    gBuf[i] = rgba[o + 1];
    bBuf[i] = rgba[o + 2];
  }
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const diffuse = (buf: Float32Array, idx: number, err: number, x: number) => {
    if (x + 1 < width) buf[idx + 1] += (err * 7) / 16;
    const below = idx + width;
    if (below < n) {
      if (x > 0) buf[below - 1] += (err * 3) / 16;
      buf[below] += (err * 5) / 16;
      if (x + 1 < width) buf[below + 1] += (err * 1) / 16;
    }
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const r = clamp(rBuf[idx]);
      const g = clamp(gBuf[idx]);
      const b = clamp(bBuf[idx]);
      const r5 = Math.round((r * 31) / 255);
      const g6 = Math.round((g * 63) / 255);
      const b5 = Math.round((b * 31) / 255);
      out[idx] = ((r5 << 11) | (g6 << 5) | b5) & 0xffff;
      diffuse(rBuf, idx, r - ((r5 << 3) | (r5 >> 2)), x);
      diffuse(gBuf, idx, g - ((g6 << 2) | (g6 >> 4)), x);
      diffuse(bBuf, idx, b - ((b5 << 3) | (b5 >> 2)), x);
    }
  }
  return out;
}
