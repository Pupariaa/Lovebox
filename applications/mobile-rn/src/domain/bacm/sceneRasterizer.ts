import {
  AlphaType,
  ColorType,
  Skia,
  type SkFont,
  type SkImage,
} from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import { blend565, color565To888, ditherRgba8888To565, rgb888To565 } from "./rgb565";
import { compositeFrameOnBg } from "./composite";
import { fontFor, isFontReady, type FontId } from "./font";
import type { IconFrameData } from "./frame";
import { hasEmoji, segmentEmojiText } from "./twemoji";
import type { MessageLayer, MessageScene } from "./scene";

const EMOJI_ADVANCE_RATIO = 1.12;

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

function makeFrameImage(frame: IconFrameData): SkImage | null {
  const { side, pixels, alpha } = frame;
  const rgba = new Uint8Array(side * side * 4);
  for (let i = 0; i < side * side; i++) {
    const { r, g, b } = color565To888(pixels[i]);
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = alpha ? alpha[i] : 255;
  }
  const data = Skia.Data.fromBytes(rgba);
  return Skia.Image.MakeImage(
    {
      width: side,
      height: side,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    },
    data,
    side * 4,
  );
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
  for (const line of lines) maxW = Math.max(maxW, measureLineWidth(font, line, fontSize));
  return {
    w: Math.round(maxW + TEXT_PAD_X * 2),
    h: Math.round(lines.length * lh + TEXT_PAD_Y * 2),
  };
}

function measureLineWidth(font: SkFont, line: string, fontSize: number): number {
  if (!hasEmoji(line)) return measureWidth(font, line);
  let w = 0;
  for (const seg of segmentEmojiText(line)) {
    if (seg.kind === "text") w += measureWidth(font, seg.value);
    else w += fontSize * EMOJI_ADVANCE_RATIO;
  }
  return w;
}

export class SceneRasterizer {
  rasterBackground(scene: MessageScene, bgImage: SkImage | null): Uint16Array {
    const rgba = readRgba((canvas) => {
      canvas.clear(Skia.Color(scene.bgColor));
      if (scene.bgType === "image" && bgImage) {
        drawCover(canvas, bgImage, 0, 0, W, H);
      }
    }, W, H);
    if (!rgba) return new Uint16Array(W * H).fill(rgb888To565(0, 0, 0));
    // Dither only photo backgrounds; a flat color fill has no banding to hide and dithering it
    // would add unwanted noise.
    if (scene.bgType === "image" && bgImage) {
      return ditherRgba8888To565(rgba, W, H);
    }
    const out = new Uint16Array(W * H);
    for (let i = 0; i < out.length; i++) {
      const o = i * 4;
      out[i] = rgb888To565(rgba[o], rgba[o + 1], rgba[o + 2]);
    }
    return out;
  }

  bakeText(bg: Uint16Array, layer: MessageLayer, emojiImages?: Map<string, SkImage>): void {
    if (!layer.text) return;
    const font = fontFor(layer.fontId, layer.fontSize);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(layer.color));
    paint.setAntiAlias(true);
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    const metrics = font.getMetrics();
    const ascent = metrics ? -metrics.ascent : layer.fontSize * 0.8;
    const descent = metrics ? metrics.descent : layer.fontSize * 0.2;
    const lines = layer.text.split("\n");
    const lh = layer.fontSize * LINE_RATIO;
    const blockH = lines.length * lh;
    const blockTop = (layer.h - blockH) / 2;
    const emojiSize = layer.fontSize;
    const emojiAdvance = layer.fontSize * EMOJI_ADVANCE_RATIO;

    this.drawRotated(bg, layer.x, layer.y, layer.w, layer.h, layer.rotation, (canvas) => {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cellTop = blockTop + i * lh;
        const baseline = cellTop + (lh - (ascent + descent)) / 2 + ascent;
        const lw = measureLineWidth(font, line, layer.fontSize);
        let x: number;
        if (layer.align === "left") x = TEXT_PAD_X;
        else if (layer.align === "right") x = layer.w - TEXT_PAD_X - lw;
        else x = (layer.w - lw) / 2;

        if (!emojiImages || !hasEmoji(line)) {
          canvas.drawText(line, x, baseline, paint, font);
          continue;
        }
        let penX = x;
        for (const seg of segmentEmojiText(line)) {
          if (seg.kind === "text") {
            canvas.drawText(seg.value, penX, baseline, paint, font);
            penX += measureWidth(font, seg.value);
          } else {
            const img = emojiImages.get(seg.ref);
            if (img) {
              const top = baseline - ascent + (ascent + descent - emojiSize) / 2;
              const dst = Skia.XYWHRect(
                penX + (emojiAdvance - emojiSize) / 2,
                top,
                emojiSize,
                emojiSize,
              );
              canvas.drawImageRect(
                img,
                Skia.XYWHRect(0, 0, img.width(), img.height()),
                dst,
                imgPaint,
              );
            }
            penX += emojiAdvance;
          }
        }
      }
    });
  }

  bakeImage(bg: Uint16Array, layer: MessageLayer, image: SkImage): void {
    this.drawRotated(bg, layer.x, layer.y, layer.w, layer.h, layer.rotation, (canvas) => {
      drawCover(canvas, image, 0, 0, layer.w, layer.h);
    });
  }

  bakeIconFrame(bg: Uint16Array, layer: MessageLayer, frame: IconFrameData): void {
    const rot = ((layer.rotation % 360) + 360) % 360;
    if (!rot) {
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
      return;
    }
    const image = makeFrameImage(frame);
    if (!image) return;
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    this.drawRotated(bg, layer.x, layer.y, layer.size, layer.size, layer.rotation, (canvas) => {
      canvas.drawImageRect(
        image,
        Skia.XYWHRect(0, 0, image.width(), image.height()),
        Skia.XYWHRect(0, 0, layer.size, layer.size),
        imgPaint,
      );
    });
  }

  private drawRotated(
    bg: Uint16Array,
    ox: number,
    oy: number,
    w: number,
    h: number,
    rotationDeg: number,
    draw: (canvas: import("@shopify/react-native-skia").SkCanvas) => void,
  ): void {
    const rot = ((rotationDeg % 360) + 360) % 360;
    if (!rot) {
      const rgba = readRgba(draw, w, h);
      if (rgba) this.compositeRgbaOnto565(bg, rgba, w, h, Math.round(ox), Math.round(oy));
      return;
    }
    const rad = (rot * Math.PI) / 180;
    const bw = Math.max(1, Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))));
    const bh = Math.max(1, Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))));
    const rgba = readRgba((canvas) => {
      canvas.translate((bw - w) / 2, (bh - h) / 2);
      canvas.rotate(rot, w / 2, h / 2);
      draw(canvas);
    }, bw, bh);
    const cx = ox + w / 2;
    const cy = oy + h / 2;
    if (rgba) {
      this.compositeRgbaOnto565(bg, rgba, bw, bh, Math.round(cx - bw / 2), Math.round(cy - bh / 2));
    }
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
