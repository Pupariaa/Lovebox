import { requireOptionalNativeModule } from "expo-modules-core";
import { AlphaType, ColorType, Skia, type SkImage } from "@shopify/react-native-skia";
import { AppConfig } from "@/config/AppConfig";
import {
  frameFromRgbaDithered,
  resizeFrame,
  MAX_FRAMES,
  type IconFrameData,
} from "@/domain/bacm/frame";
import type { LoadedEmoji } from "@/domain/bacm/fluentEmoji";
import { loadSkImage } from "@/domain/bacm/imageLoader";

export const VIDEO_PREFIX = "video:";

export class VideoModuleUnavailableError extends Error {
  constructor() {
    super("expo-video-thumbnails native module unavailable");
    this.name = "VideoModuleUnavailableError";
  }
}

const BASE = 240;
const registry = new Map<string, LoadedEmoji>();

type NativeThumbnailResult = { uri: string; width: number; height: number };
type NativeVideoThumbnails = {
  getThumbnail: (
    sourceFilename: string,
    options: { time?: number; quality?: number },
  ) => Promise<NativeThumbnailResult>;
};

// Access the native module directly and optionally: this returns null instead of
// throwing when the module is missing from the dev client, so importing this file
// never crashes the app and video simply reports as unavailable until a rebuild.
function getNativeVideoThumbnails(): NativeVideoThumbnails | null {
  return requireOptionalNativeModule<NativeVideoThumbnails>("ExpoVideoThumbnails");
}

function drawSquareCover(image: SkImage, size: number): Uint8Array | null {
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#00000000"));
  const iw = image.width();
  const ih = image.height();
  const scale = Math.max(size / iw, size / ih);
  const w = iw * scale;
  const h = ih * scale;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect((size - w) / 2, (size - h) / 2, w, h),
    paint,
  );
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, {
    width: size,
    height: size,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  return pixels ? (pixels as Uint8Array) : null;
}

// Extracts up to VIDEO_FRAME_COUNT frames from the first VIDEO_MAX_SECONDS of a video
// and stores them as an animated layer source (same shape as GIF/emoji frames). Returns
// a ref usable by loadEmoji, or null when nothing could be decoded.
export async function extractVideoToLayer(
  videoUri: string,
  durationMs: number | null,
): Promise<string | null> {
  const nativeThumbnails = getNativeVideoThumbnails();
  if (!nativeThumbnails) throw new VideoModuleUnavailableError();

  const maxMs = AppConfig.VIDEO_MAX_SECONDS * 1000;
  const total = durationMs && durationMs > 0 ? Math.min(durationMs, maxMs) : maxMs;
  const count = Math.max(2, Math.min(AppConfig.VIDEO_FRAME_COUNT, MAX_FRAMES));

  const frames: IconFrameData[] = [];
  for (let i = 0; i < count; i++) {
    const time = count > 1 ? Math.round((i * total) / (count - 1)) : 0;
    let uri: string;
    try {
      const result = await nativeThumbnails.getThumbnail(videoUri, {
        time,
        quality: 0.9,
      });
      uri = result.uri;
    } catch {
      continue;
    }
    const image = await loadSkImage(uri);
    if (!image) continue;
    const rgba = drawSquareCover(image, BASE);
    if (!rgba) continue;
    frames.push(frameFromRgbaDithered(rgba, BASE, BASE, BASE));
  }

  if (frames.length === 0) return null;

  const fps = Math.max(4, Math.min(20, Math.round((frames.length * 1000) / total)));
  const id = `${VIDEO_PREFIX}${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  registry.set(id, { frames, fps, animated: frames.length > 1 });
  return id;
}

export function loadVideoLayer(ref: string, size: number): LoadedEmoji | null {
  const base = registry.get(ref);
  if (!base) return null;
  if (size === BASE) return base;
  return {
    fps: base.fps,
    animated: base.animated,
    frames: base.frames.map((f) => resizeFrame(f.pixels, f.side, f.alpha, size)),
  };
}
