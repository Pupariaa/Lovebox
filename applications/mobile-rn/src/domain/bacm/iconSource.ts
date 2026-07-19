import {
  loadEmoji as loadFluent,
  loadThumbnail as loadFluentThumb,
  loadRemote,
  loadRemoteThumb,
  type LoadedEmoji,
} from "./fluentEmoji";
import { loadGif, loadGifThumb } from "./gifDecoder";
import { twemojiUrl } from "./twemoji";
import type { IconFrameData } from "./frame";
import { loadVideoLayer, VIDEO_PREFIX } from "@/domain/video/videoFrames";

export type { LoadedEmoji };

const TWEMOJI_PREFIX = "twemoji:";
const GIF_PREFIX = "gif:";

export async function loadEmoji(ref: string, size: number): Promise<LoadedEmoji | null> {
  if (ref.startsWith("emoji:")) return loadFluent(ref, size);
  if (ref.startsWith(TWEMOJI_PREFIX)) {
    return loadRemote(twemojiUrl(ref.slice(TWEMOJI_PREFIX.length)), size, ref);
  }
  if (ref.startsWith(VIDEO_PREFIX)) return loadVideoLayer(ref, size);
  if (ref.startsWith(GIF_PREFIX)) return loadGif(ref.slice(GIF_PREFIX.length), size);
  return null;
}

export async function loadThumbnail(
  ref: string,
  size = 44,
): Promise<IconFrameData | null> {
  if (ref.startsWith("emoji:")) return loadFluentThumb(ref, size);
  if (ref.startsWith(TWEMOJI_PREFIX)) {
    return loadRemoteThumb(twemojiUrl(ref.slice(TWEMOJI_PREFIX.length)), size, ref);
  }
  if (ref.startsWith(VIDEO_PREFIX)) {
    const loaded = loadVideoLayer(ref, size);
    return loaded ? loaded.frames[0] ?? null : null;
  }
  if (ref.startsWith(GIF_PREFIX)) return loadGifThumb(ref.slice(GIF_PREFIX.length), size);
  return null;
} 
