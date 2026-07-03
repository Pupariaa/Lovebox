import { Skia, type SkImage } from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system/legacy";

const imageCache = new Map<string, SkImage | null>();

export async function loadSkImage(uri: string): Promise<SkImage | null> {
  const cached = imageCache.get(uri);
  if (cached !== undefined) return cached;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const data = Skia.Data.fromBase64(base64);
    const image = Skia.Image.MakeImageFromEncoded(data);
    imageCache.set(uri, image ?? null);
    return image ?? null;
  } catch {
    imageCache.set(uri, null);
    return null;
  }
}
