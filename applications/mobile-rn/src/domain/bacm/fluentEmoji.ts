import UPNG from "upng-js";
import * as FileSystem from "expo-file-system/legacy";
import manifest from "@/data/fluent-emoji-manifest.json";
import {
  base64ToBytes,
  frameFromRgba,
  sampleFrameIndices,
  type IconFrameData,
} from "./frame";

type ManifestIcon = {
  id: string;
  label: string;
  category: string;
  file: string;
  keywords?: string;
};

export type FluentManifestIcon = ManifestIcon;

type Manifest = {
  cdn: string;
  refPrefix: string;
  categories: string[];
  icons: ManifestIcon[];
};

const M = manifest as Manifest;
const REF_PREFIX = M.refPrefix || "emoji:";
const CDN = M.cdn || "https://cdn.jsdelivr.net/gh/bignutty/fluent-emoji@main/animated/";
const CACHE_DIR = `${FileSystem.cacheDirectory}emoji-cache/`;

const iconById = new Map<string, ManifestIcon>();
M.icons.forEach((ic) => iconById.set(ic.id, ic));

// Pre-computed lowercase search index so keystroke filtering avoids re-lowercasing 1000 labels.
const searchIndex: { ic: ManifestIcon; text: string }[] = M.icons.map((ic) => ({
  ic,
  text: `${ic.label} ${ic.keywords ?? ""}`.toLowerCase(),
}));

export const EMOJI_CATEGORIES = M.categories;

// Limit simultaneous APNG decodes: UPNG decoding blocks the JS thread, so decoding dozens of
// picker cells at once is what makes scrolling stutter. A small semaphore keeps the UI responsive.
const MAX_CONCURRENT_DECODES = 3;
let activeDecodes = 0;
const decodeWaiters: (() => void)[] = [];

function acquireDecodeSlot(): Promise<void> {
  if (activeDecodes < MAX_CONCURRENT_DECODES) {
    activeDecodes++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    decodeWaiters.push(() => {
      activeDecodes++;
      resolve();
    });
  });
}

function releaseDecodeSlot(): void {
  activeDecodes--;
  const next = decodeWaiters.shift();
  if (next) next();
}

export type LoadedEmoji = {
  frames: IconFrameData[];
  fps: number;
  animated: boolean;
};

const emojiCache = new Map<string, LoadedEmoji>();
const thumbCache = new Map<string, IconFrameData>();
const inflight = new Map<string, Promise<LoadedEmoji | null>>();
const thumbInflight = new Map<string, Promise<IconFrameData | null>>();
let dirReady = false;

export function parseEmojiRef(ref: string): string | null {
  if (!ref || ref.indexOf(REF_PREFIX) !== 0) return null;
  return ref.slice(REF_PREFIX.length);
}

export function emojiRef(id: string): string {
  return REF_PREFIX + id;
}

export function isEmojiRef(ref: string): boolean {
  const id = parseEmojiRef(ref);
  return id != null && iconById.has(id);
}

export function searchEmojis(
  query: string,
  category: string | null,
  limit = 200,
): ManifestIcon[] {
  const q = query.trim().toLowerCase();
  const filterCat = category && category !== "all" ? category : null;
  const out: ManifestIcon[] = [];
  for (const entry of searchIndex) {
    if (filterCat && entry.ic.category !== filterCat) continue;
    if (q && entry.text.indexOf(q) === -1) continue;
    out.push(entry.ic);
    if (limit > 0 && out.length >= limit) break;
  }
  return out;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.endsWith(".png") ? cleaned : `${cleaned}.png`;
}

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  dirReady = true;
}

async function fetchPngBytes(url: string, cacheName: string): Promise<Uint8Array | null> {
  try {
    await ensureDir();
    const fileUri = `${CACHE_DIR}${cacheName}`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      const res = await FileSystem.downloadAsync(url, fileUri);
      if (res.status !== 200) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
        return null;
      }
    }
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

type DecodedApng = {
  rgbaFrames: ArrayBuffer[];
  width: number;
  height: number;
  delays: number[];
  animated: boolean;
};

function decodeApngBytes(bytes: Uint8Array): DecodedApng | null {
  try {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const img = UPNG.decode(buffer);
    const rgbaFrames = UPNG.toRGBA8(img);
    if (rgbaFrames.length === 0) return null;
    const animated = !!img.tabs?.acTL && rgbaFrames.length > 1;
    const delays = rgbaFrames.map((_, i) => img.frames[i]?.delay ?? 0);
    return { rgbaFrames, width: img.width, height: img.height, delays, animated };
  } catch {
    return null;
  }
}

function buildLoaded(decoded: DecodedApng, size: number): LoadedEmoji {
  const { rgbaFrames, width, height, delays, animated } = decoded;
  const indices = sampleFrameIndices(rgbaFrames.length);
  const frames: IconFrameData[] = [];
  let delaySum = 0;
  let delayCount = 0;
  for (const i of indices) {
    const rgba = new Uint8Array(rgbaFrames[i]);
    frames.push(frameFromRgba(rgba, width, height, size));
    const d = animated ? delays[i] : 0;
    if (d > 0) {
      delaySum += d;
      delayCount++;
    }
  }
  let fps = 12;
  if (delayCount > 0) {
    const avg = delaySum / delayCount;
    fps = Math.max(4, Math.min(20, Math.round(1000 / avg)));
  }
  return { frames, fps, animated };
}

async function loadPng(
  url: string,
  cacheName: string,
  size: number,
  cacheKey: string,
): Promise<LoadedEmoji | null> {
  const key = `${cacheKey}@${size}`;
  const cached = emojiCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const bytes = await fetchPngBytes(url, cacheName);
    if (!bytes) return null;
    const decoded = decodeApngBytes(bytes);
    if (!decoded) return null;
    return buildLoaded(decoded, size);
  })()
    .then((result) => {
      if (result) emojiCache.set(key, result);
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

async function loadPngThumb(
  url: string,
  cacheName: string,
  size: number,
  cacheKey: string,
): Promise<IconFrameData | null> {
  const key = `${cacheKey}@${size}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const full = emojiCache.get(key);
  if (full) return full.frames[0];
  const pending = thumbInflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const bytes = await fetchPngBytes(url, cacheName);
    if (!bytes) return null;
    await acquireDecodeSlot();
    try {
      const decoded = decodeApngBytes(bytes);
      if (!decoded || decoded.rgbaFrames.length === 0) return null;
      const rgba = new Uint8Array(decoded.rgbaFrames[0]);
      return frameFromRgba(rgba, decoded.width, decoded.height, size);
    } finally {
      releaseDecodeSlot();
    }
  })()
    .then((frame) => {
      thumbInflight.delete(key);
      if (frame) thumbCache.set(key, frame);
      return frame;
    })
    .catch(() => {
      thumbInflight.delete(key);
      return null;
    });
  thumbInflight.set(key, promise);
  return promise;
}

export async function loadEmoji(
  ref: string,
  size: number,
): Promise<LoadedEmoji | null> {
  const id = parseEmojiRef(ref);
  if (!id) return null;
  const icon = iconById.get(id);
  if (!icon) return null;
  return loadPng(CDN + encodeURIComponent(icon.file), safeName(icon.file), size, id);
}

export async function loadThumbnail(
  ref: string,
  size = 44,
): Promise<IconFrameData | null> {
  const id = parseEmojiRef(ref);
  if (!id) return null;
  const icon = iconById.get(id);
  if (!icon) return null;
  return loadPngThumb(CDN + encodeURIComponent(icon.file), safeName(icon.file), size, id);
}

export async function loadRemote(
  url: string,
  size: number,
  cacheKey: string,
): Promise<LoadedEmoji | null> {
  return loadPng(url, safeName(cacheKey), size, cacheKey);
}

export async function loadRemoteThumb(
  url: string,
  size: number,
  cacheKey: string,
): Promise<IconFrameData | null> {
  return loadPngThumb(url, safeName(cacheKey), size, cacheKey);
}

export function fluentIconUrl(refOrId: string): string | null {
  const id = refOrId.startsWith(REF_PREFIX) ? parseEmojiRef(refOrId) : refOrId;
  if (!id) return null;
  const icon = iconById.get(id);
  if (!icon) return null;
  return CDN + icon.file;
}
