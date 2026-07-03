import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import { color565To888 } from "./rgb565";
import { SceneRasterizer } from "./sceneRasterizer";
import type { IconFrameData } from "./frame";
import type { MessageScene } from "./scene";

const W = AppConfig.MSG_WIDTH;
const H = AppConfig.MSG_HEIGHT;

export type PreviewDeps = {
  framesByLayerId: Map<string, IconFrameData[]>;
  imagesByUri: Map<string, SkImage>;
};

export function composeScene(
  scene: MessageScene,
  rasterizer: SceneRasterizer,
  deps: PreviewDeps,
  frameIndex: number,
  opts?: { skipText?: boolean },
): Uint16Array {
  const bgImage = scene.bgImageUri ? deps.imagesByUri.get(scene.bgImageUri) ?? null : null;
  const bg = rasterizer.rasterBackground(scene, bgImage);
  for (const layer of scene.layers) {
    if (layer.hidden) continue;
    if (layer.type === "text") {
      if (!opts?.skipText) rasterizer.bakeText(bg, layer);
    } else if (layer.type === "photo") {
      if (layer.imageUri) {
        const image = deps.imagesByUri.get(layer.imageUri);
        if (image) rasterizer.bakeImage(bg, layer, image);
      }
    } else if (layer.type === "icon") {
      const frames = deps.framesByLayerId.get(layer.id);
      if (frames && frames.length > 0) {
        const frame = frames[frameIndex % frames.length];
        rasterizer.bakeIconFrame(bg, layer, frame);
      }
    }
  }
  return bg;
}

export function rgb565ToRgba(pixels: Uint16Array): Uint8Array {
  const out = new Uint8Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const { r, g, b } = color565To888(pixels[i]);
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}

export function makeSkImageFromRgb565(pixels: Uint16Array): SkImage | null {
  const rgba = rgb565ToRgba(pixels);
  const data = Skia.Data.fromBytes(rgba);
  return Skia.Image.MakeImage(
    {
      width: W,
      height: H,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Opaque,
    },
    data,
    W * 4,
  );
}

export function makeSkImageFromFrame(frame: IconFrameData): SkImage | null {
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

export function composeBackground(
  scene: MessageScene,
  rasterizer: SceneRasterizer,
  bgImage: SkImage | null,
): Uint16Array {
  return rasterizer.rasterBackground(scene, bgImage);
}
