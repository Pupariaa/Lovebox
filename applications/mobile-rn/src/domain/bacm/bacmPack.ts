import { AppConfig } from "@/config/AppConfig";
import { compositeIconOnBgCopy, cropRect } from "./composite";
import { loadEmoji } from "./emojiFrameLoader";
import { ensureFontsLoaded } from "./font";
import type { IconFrameData } from "./frame";
import { loadSkImage } from "./imageLoader";
import { SceneRasterizer } from "./sceneRasterizer";
import type { MessageScene } from "./scene";

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
  const layers: AnimLayer[] = [];

  for (const layer of scene.layers) {
    if (layer.hidden) continue;
    if (layer.type === "text") {
      rasterizer.bakeText(bg, layer);
    } else if (layer.type === "photo") {
      if (layer.imageUri) {
        const image = await loadSkImage(layer.imageUri);
        if (image) rasterizer.bakeImage(bg, layer, image);
      }
    } else if (layer.type === "icon") {
      const emoji = await loadEmoji(layer.ref, layer.size);
      if (emoji && emoji.frames.length > 0) {
        if (layer.anim && emoji.animated && emoji.frames.length > 1) {
          layers.push(buildAnimLayer(bg, layer, emoji.frames, emoji.fps));
        } else {
          rasterizer.bakeIconFrame(bg, layer, emoji.frames[0]);
        }
      }
    }
  }

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
