import {
  AlphaType,
  ColorType,
  Skia,
  type SkFont,
  type SkImage,
} from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import { blend565, rgb888To565 } from "./rgb565";
import { compositeFrameOnBg } from "./composite";
import { fontFor, isFontReady, type FontId } from "./font";
import type { IconFrameData } from "./frame";
import type { MessageLayer, MessageScene } from "./scene";

const W = AppConfig.MSG_WIDTH;
const H = AppConfig.MSG_HEIGHT;
const LINE_RATIO = 1.28;
const TEXT_PAD_X = 10;
const TEXT_PAD_Y = 6;

function readRgba(
  draw: (canvas: import("@shopify/react-native-skia").SkCanvas) => void,
  width: number,
  height: number,
): Uint8Array | null {
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  draw(canvas);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  return pixels ? (pixels as Uint8Array) : null;
}

function measureWidth(font: SkFont, text: string): number {
  if (text.length === 0) return 0;
  try {
    const result = font.measureText(text) as unknown;
    if (typeof result === "number") return result;
    if (result && typeof (result as { width: number }).width === "number") {
      return (result as { width: number }).width;
    }
  } catch {
    // fall through to estimate
  }
  return text.length * font.getSize() * 0.55;
}

export function measureTextBox(
  text: string,
  fontSize: number,
  fontId: FontId = "poppins",
): { w: number; h: number } {
  const lines = (text.length ? text : " ").split("\n");
  const lh = fontSize * LINE_RATIO;
  if (!isFontReady(fontId)) {
    const maxLen = lines.reduce((m, l) => Math.max(m, l.length), 1);
    return {
      w: Math.round(maxLen * fontSize * 0.58 + TEXT_PAD_X * 2),
      h: Math.round(lines.length * lh + TEXT_PAD_Y * 2),
    };
  }
  const font = fontFor(fontId, fontSize);
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, measureWidth(font, line));
  return {
    w: Math.round(maxW + TEXT_PAD_X * 2),
    h: Math.round(lines.length * lh + TEXT_PAD_Y * 2),
  };
}

export class SceneRasterizer {
  rasterBackground(scene: MessageScene, bgImage: SkImage | null): Uint16Array {
    const rgba = readRgba((canvas) => {
      canvas.clear(Skia.Color(scene.bgColor));
      if (scene.bgType === "image" && bgImage) {
        drawCover(canvas, bgImage, 0, 0, W, H);
      }
    }, W, H);
    const out = new Uint16Array(W * H);
    if (!rgba) return out.fill(rgb888To565(0, 0, 0));
    for (let i = 0; i < out.length; i++) {
      const o = i * 4;
      out[i] = rgb888To565(rgba[o], rgba[o + 1], rgba[o + 2]);
    }
    return out;
  }

  bakeText(bg: Uint16Array, layer: MessageLayer): void {
    if (!layer.text) return;
    const font = fontFor(layer.fontId, layer.fontSize);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(layer.color));
    paint.setAntiAlias(true);
    const metrics = font.getMetrics();
    const ascent = metrics ? -metrics.ascent : layer.fontSize * 0.8;
    const descent = metrics ? metrics.descent : layer.fontSize * 0.2;
    const lines = layer.text.split("\n");
    const lh = layer.fontSize * LINE_RATIO;
    const blockH = lines.length * lh;
    const blockTop = (layer.h - blockH) / 2;

    const rgba = readRgba((canvas) => {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cellTop = blockTop + i * lh;
        const baseline = cellTop + (lh - (ascent + descent)) / 2 + ascent;
        const lw = measureWidth(font, line);
        let x: number;
        if (layer.align === "left") x = TEXT_PAD_X;
        else if (layer.align === "right") x = layer.w - TEXT_PAD_X - lw;
        else x = (layer.w - lw) / 2;
        canvas.drawText(line, x, baseline, paint, font);
      }
    }, layer.w, layer.h);
    if (rgba) this.compositeRgbaOnto565(bg, rgba, layer.w, layer.h, layer.x, layer.y);
  }

  bakeImage(bg: Uint16Array, layer: MessageLayer, image: SkImage): void {
    const rgba = readRgba((canvas) => {
      drawCover(canvas, image, 0, 0, layer.w, layer.h);
    }, layer.w, layer.h);
    if (rgba) this.compositeRgbaOnto565(bg, rgba, layer.w, layer.h, layer.x, layer.y);
  }

  bakeIconFrame(bg: Uint16Array, layer: MessageLayer, frame: IconFrameData): void {
    compositeFrameOnBg(
      bg,
      W,
      H,
      frame.pixels,
      frame.side,
      frame.side,
      frame.alpha,
      layer.x,
      layer.y,
      layer.size,
      layer.size,
    );
  }

  private compositeRgbaOnto565(
    bg: Uint16Array,
    rgba: Uint8Array,
    w: number,
    h: number,
    ox: number,
    oy: number,
  ): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const a = rgba[o + 3];
        if (a < 8) continue;
        const fg = rgb888To565(rgba[o], rgba[o + 1], rgba[o + 2]);
        const bi = (oy + y) * W + (ox + x);
        if (bi < 0 || bi >= bg.length) continue;
        bg[bi] = a >= 250 ? fg : blend565(bg[bi] & 0xffff, fg, a);
      }
    }
  }
}

function drawCover(
  canvas: import("@shopify/react-native-skia").SkCanvas,
  image: SkImage,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const iw = image.width();
  const ih = image.height();
  const scale = Math.max(dw / iw, dh / ih);
  const w = iw * scale;
  const h = ih * scale;
  const rect = Skia.XYWHRect(dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, iw, ih),
    rect,
    paint,
  );
}
