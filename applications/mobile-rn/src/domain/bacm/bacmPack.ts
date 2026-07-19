import { AlphaType, ColorType, Skia, type SkImage } from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import { compositeIconOnBgCopy, cropRect } from "./composite";
import { loadEmoji } from "./emojiFrameLoader";
import { ensureFontsLoaded } from "./font";
import type { IconFrameData } from "./frame";
import { loadSkImage } from "./imageLoader";
import { rgb888To565 } from "./rgb565";
import { makeSkImageFromFrame } from "./scenePreview";
import { SceneRasterizer } from "./sceneRasterizer";
import type { MessageScene } from "./scene";
import { hasEmoji, segmentEmojiText, twemojiRefToCodePoints, twemojiUrl } from "./twemoji";

// Bakes rotation into an animated icon frame (device receives pre-rendered pixels). Rotation is
// applied about the frame center within the same square, matching the static bake behaviour.
function rotateIconFrame(frame: IconFrameData, deg: number): IconFrameData {
  const rot = ((deg % 360) + 360) % 360;
  if (!rot) return frame;
  const src = makeSkImageFromFrame(frame);
  if (!src) return frame;
  const side = frame.side;
  const surface = Skia.Surface.MakeOffscreen(side, side);
  if (!surface) return frame;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.rotate(rot, side / 2, side / 2);
  canvas.drawImageRect(
    src,
    Skia.XYWHRect(0, 0, side, side),
    Skia.XYWHRect(0, 0, side, side),
    paint,
  );
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const rgba = snapshot.readPixels(0, 0, {
    width: side,
    height: side,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  }) as Uint8Array | null;
  if (!rgba) return frame;
  const pixels = new Uint16Array(side * side);
  const alpha = new Uint8Array(side * side);
  for (let i = 0; i < side * side; i++) {
    const o = i * 4;
    pixels[i] = rgb888To565(rgba[o], rgba[o + 1], rgba[o + 2]);
    alpha[i] = rgba[o + 3];
  }
  return { side, pixels, alpha };
}

async function loadTextEmojiImages(text: string): Promise<Map<string, SkImage>> {
  const map = new Map<string, SkImage>();
  if (!text || !hasEmoji(text)) return map;
  const refs = new Set<string>();
  for (const seg of segmentEmojiText(text)) {
    if (seg.kind === "emoji") refs.add(seg.ref);
  }
  await Promise.all(
    Array.from(refs).map(async (ref) => {
      const image = await loadSkImage(twemojiUrl(twemojiRefToCodePoints(ref)));
      if (image) map.set(ref, image);
    }),
  );
  return map;
}

export const LAYER_STATIC = 0;
export const LAYER_ANIM = 1;

type AnimLayer = {
  type: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fps: number;
  frameCount: number;
  data: Uint16Array;
};

type AnimSpec = {
  layer: MessageScene["layers"][number];
  frames: IconFrameData[];
  fps: number;
};

// Picks n evenly-spaced frames from a sequence (keeps first and last).
function sampleFrames(frames: IconFrameData[], n: number): IconFrameData[] {
  if (n >= frames.length) return frames;
  if (n <= 1) return [frames[0]];
  const out: IconFrameData[] = [];
  for (let i = 0; i < n; i++) {
    out.push(frames[Math.round((i * (frames.length - 1)) / (n - 1))]);
  }
  return out;
}

// Guarantees the packed message fits the firmware buffer (MSG_MAX_BYTES). Animated layers are the
// only variable-size part, so when the total would overflow we scale every animated layer's frame
// count down proportionally and lower its fps to preserve the original playback duration.
function fitAnimLayers(bg: Uint16Array, specs: AnimSpec[]): AnimLayer[] {
  if (specs.length === 0) return [];
  const overhead = 12 + specs.length * 16;
  const bgBytes = bg.length * 2;
  const available = AppConfig.MSG_MAX_BYTES - overhead - bgBytes;
  let totalAnim = 0;
  for (const s of specs) {
    totalAnim += s.layer.size * s.layer.size * 2 * s.frames.length;
  }
  const factor = totalAnim > available && totalAnim > 0 ? available / totalAnim : 1;
  return specs.map((s) => {
    const full = s.frames.length;
    let fc = full;
    if (factor < 1) fc = Math.max(2, Math.floor(full * factor));
    const frames = fc < full ? sampleFrames(s.frames, fc) : s.frames;
    const fps = fc < full ? Math.max(2, Math.round((s.fps * fc) / full)) : s.fps;
    return buildAnimLayer(bg, s.layer, frames, fps);
  });
}

function buildAnimLayer(
  bg: Uint16Array,
  layer: MessageScene["layers"][number],
  frames: IconFrameData[],
  fps: number,
): AnimLayer {
  const side = layer.size;
  const framePixels = new Uint16Array(side * side * frames.length);
  frames.forEach((frame, index) => {
    const composed = compositeIconOnBgCopy(
      bg,
      layer.x,
      layer.y,
      side,
      frame.pixels,
      frame.side,
      frame.alpha,
    );
    const crop = cropRect(composed, AppConfig.MSG_WIDTH, layer.x, layer.y, side, side);
    framePixels.set(crop, index * side * side);
  });
  return {
    type: LAYER_ANIM,
    x: layer.x,
    y: layer.y,
    w: side,
    h: side,
    fps,
    frameCount: frames.length,
    data: framePixels,
  };
}

export async function buildFromScene(scene: MessageScene): Promise<Uint8Array> {
  await ensureFontsLoaded();
  const rasterizer = new SceneRasterizer();
  const bgImage =
    scene.bgType === "image" && scene.bgImageUri
      ? await loadSkImage(scene.bgImageUri)
      : null;
  const bg = rasterizer.rasterBackground(scene, bgImage);
  const animSpecs: AnimSpec[] = [];

  for (const layer of scene.layers) {
    if (layer.hidden) continue;
    if (layer.type === "text") {
      const emojiImages = await loadTextEmojiImages(layer.text ?? "");
      rasterizer.bakeText(bg, layer, emojiImages);
    } else if (layer.type === "photo") {
      if (layer.imageUri) {
        const image = await loadSkImage(layer.imageUri);
        if (image) rasterizer.bakeImage(bg, layer, image);
      }
    } else if (layer.type === "icon") {
      const emoji = await loadEmoji(layer.ref, layer.size);
      if (emoji && emoji.frames.length > 0) {
        if (layer.anim && emoji.animated && emoji.frames.length > 1) {
          const frames = layer.rotation
            ? emoji.frames.map((f) => rotateIconFrame(f, layer.rotation))
            : emoji.frames;
          animSpecs.push({ layer, frames, fps: emoji.fps });
        } else {
          rasterizer.bakeIconFrame(bg, layer, emoji.frames[0]);
        }
      }
    }
  }

  const layers = fitAnimLayers(bg, animSpecs);
  return packMessage(bg, layers);
}

function writeU16(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
  buf[off + 2] = (v >> 16) & 0xff;
  buf[off + 3] = (v >> 24) & 0xff;
}

function packMessage(bg: Uint16Array, layers: AnimLayer[]): Uint8Array {
  let total = 12 + bg.length * 2;
  for (const layer of layers) total += 16 + layer.data.length * 2;
  const buf = new Uint8Array(total);
  buf[0] = 0x42;
  buf[1] = 0x41;
  buf[2] = 0x43;
  buf[3] = 0x4d;
  writeU16(buf, 4, 1);
  writeU16(buf, 6, AppConfig.MSG_WIDTH);
  writeU16(buf, 8, AppConfig.MSG_HEIGHT);
  buf[10] = layers.length & 0xff;
  buf[11] = 0;
  let off = 12;
  for (let i = 0; i < bg.length; i++) {
    writeU16(buf, off, bg[i] & 0xffff);
    off += 2;
  }
  for (const layer of layers) {
    buf[off] = layer.type & 0xff;
    buf[off + 1] = layer.fps & 0xff;
    writeU16(buf, off + 2, layer.x);
    writeU16(buf, off + 4, layer.y);
    writeU16(buf, off + 6, layer.w);
    writeU16(buf, off + 8, layer.h);
    writeU16(buf, off + 10, layer.frameCount);
    writeU32(buf, off + 12, layer.data.length * 2);
    off += 16;
    for (let i = 0; i < layer.data.length; i++) {
      writeU16(buf, off, layer.data[i] & 0xffff);
      off += 2;
    }
  }
  return buf;
}
