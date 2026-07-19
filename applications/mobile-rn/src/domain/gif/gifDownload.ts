import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.cacheDirectory}gif-remote/`;

function safeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Remote GIFs (Tenor/GIPHY) are downloaded to the cache so the existing local
// gif: pipeline (gifDecoder) can read them as a file URI.
export async function downloadGifToCache(url: string, id: string): Promise<string | null> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    // directory already exists
  }
  const target = `${CACHE_DIR}${safeName(id)}.gif`;
  try {
    const info = await FileSystem.getInfoAsync(target);
    if (info.exists && info.size && info.size > 0) return target;
    const result = await FileSystem.downloadAsync(url, target);
    return result.uri;
  } catch {
    return null;
  }
}
