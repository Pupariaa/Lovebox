import * as FileSystem from "expo-file-system/legacy";
import { decompressFrames, parseGIF } from "gifuct-js";
import {
  base64ToBytes,
  frameFromRgba,
  sampleFrameIndices,
  type IconFrameData,
} from "./frame";
import type { LoadedEmoji } from "./fluentEmoji";

const gifCache = new Map<string, LoadedEmoji>();
const inflight = new Map<string, Promise<LoadedEmoji | null>>();

async function decodeGif(uri: string, size: number): Promise<LoadedEmoji | null> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  if (!frames.length) return null;

  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const canvas = new Uint8Array(W * H * 4);
  let restore: Uint8Array | null = null;

  const composed: { rgba: Uint8Array; delay: number }[] = [];
  for (const f of frames) {
    const { dims, patch, disposalType, delay } = f;
    if (disposalType === 3) restore = canvas.slice();

    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const pi = (y * dims.width + x) * 4;
        const a = patch[pi + 3];
        if (a === 0) continue;
        const cx = dims.left + x;
        const cy = dims.top + y;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const ci = (cy * W + cx) * 4;
        canvas[ci] = patch[pi];
        canvas[ci + 1] = patch[pi + 1];
        canvas[ci + 2] = patch[pi + 2];
        canvas[ci + 3] = a;
      }
    }

    composed.push({ rgba: canvas.slice(), delay: delay > 0 ? delay : 100 });

    if (disposalType === 2) {
      for (let y = 0; y < dims.height; y++) {
        for (let x = 0; x < dims.width; x++) {
          const cx = dims.left + x;
          const cy = dims.top + y;
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          const ci = (cy * W + cx) * 4;
          canvas[ci] = 0;
          canvas[ci + 1] = 0;
          canvas[ci + 2] = 0;
          canvas[ci + 3] = 0;
        }
      }
    } else if (disposalType === 3 && restore) {
      canvas.set(restore);
    }
  }

  const indices = sampleFrameIndices(composed.length);
  const out: IconFrameData[] = [];
  let delaySum = 0;
  let delayCount = 0;
  for (const i of indices) {
    out.push(frameFromRgba(composed[i].rgba, W, H, size));
    if (composed[i].delay > 0) {
      delaySum += composed[i].delay;
      delayCount++;
    }
  }
  let fps = 12;
  if (delayCount > 0) {
    const avg = delaySum / delayCount;
    fps = Math.max(4, Math.min(20, Math.round(1000 / avg)));
  }
  return { frames: out, fps, animated: out.length > 1 };
}

export async function loadGif(uri: string, size: number): Promise<LoadedEmoji | null> {
  const key = `${uri}@${size}`;
  const cached = gifCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = decodeGif(uri, size)
    .then((result) => {
      if (result) gifCache.set(key, result);
      inflight.delete(key);
      return result;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });
  inflight.set(key, promise);
  return promise;
}

export async function loadGifThumb(
  uri: string,
  size: number,
): Promise<IconFrameData | null> {
  const gif = await loadGif(uri, size);
  return gif ? gif.frames[0] : null;
}
