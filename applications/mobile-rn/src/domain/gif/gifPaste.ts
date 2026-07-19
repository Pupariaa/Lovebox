import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { downloadGifToCache } from "./gifDownload";

export type PastedMedia =
  | { kind: "gif"; uri: string }
  | { kind: "image"; uri: string }
  | { kind: "none" };

const CLIPBOARD_DIR = `${FileSystem.cacheDirectory}clipboard/`;

function isGifUrl(value: string): boolean {
  const t = value.trim().toLowerCase();
  if (!t.startsWith("http")) return false;
  return (
    t.endsWith(".gif") ||
    t.includes(".gif?") ||
    t.includes("media.tenor.com") ||
    t.includes("giphy.com/media") ||
    t.includes("i.giphy.com")
  );
}

// Bridge to the system keyboard GIF button: keyboards (and share/copy flows) place a
// GIF or its URL on the clipboard. Direct GIF URLs are downloaded and kept animated;
// clipboard images are saved as a static fallback (true in-field keyboard insertion
// would require a native commitContent module and is not available on iOS).
export async function pasteMediaFromClipboard(): Promise<PastedMedia> {
  try {
    const text = (await Clipboard.getStringAsync()).trim();
    if (isGifUrl(text)) {
      const uri = await downloadGifToCache(text, `paste-${Date.now()}`);
      if (uri) return { kind: "gif", uri };
    }
  } catch {
    // ignore and try image below
  }

  try {
    if (await Clipboard.hasImageAsync()) {
      const img = await Clipboard.getImageAsync({ format: "png" });
      if (img?.data) {
        const base64 = img.data.replace(/^data:image\/\w+;base64,/, "");
        try {
          await FileSystem.makeDirectoryAsync(CLIPBOARD_DIR, { intermediates: true });
        } catch {
          // directory already exists
        }
        const uri = `${CLIPBOARD_DIR}paste-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(uri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return { kind: "image", uri };
      }
    }
  } catch {
    // ignore
  }

  return { kind: "none" };
}
