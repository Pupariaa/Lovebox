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
