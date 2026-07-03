import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Skia, type SkFont, type SkTypeface } from "@shopify/react-native-skia";
import { base64ToBytes } from "./frame";

export type FontId = "poppins" | "fredoka" | "caveat" | "playfair" | "bangers";

type FontDef = {
  id: FontId;
  label: string;
  family: string;
  module: number;
};

export const FONTS: FontDef[] = [
  {
    id: "poppins",
    label: "Poppins",
    family: "EditorPoppins",
    module: require("../../../assets/fonts/Poppins-Bold.ttf"),
  },
  {
    id: "fredoka",
    label: "Fredoka",
    family: "EditorFredoka",
    module: require("../../../assets/fonts/Fredoka-SemiBold.ttf"),
  },
  {
    id: "caveat",
    label: "Caveat",
    family: "EditorCaveat",
    module: require("../../../assets/fonts/Caveat-Bold.ttf"),
  },
  {
    id: "playfair",
    label: "Playfair",
    family: "EditorPlayfair",
    module: require("../../../assets/fonts/PlayfairDisplay-Bold.ttf"),
  },
  {
    id: "bangers",
    label: "Bangers",
    family: "EditorBangers",
    module: require("../../../assets/fonts/Bangers-Regular.ttf"),
  },
];

export const FONT_FAMILY_MAP: Record<string, number> = FONTS.reduce(
  (acc, f) => {
    acc[f.family] = f.module;
    return acc;
  },
  {} as Record<string, number>,
);

export const DEFAULT_FONT_ID: FontId = "poppins";

const typefaces = new Map<FontId, SkTypeface>();
let loadPromise: Promise<void> | null = null;

async function loadOne(def: FontDef): Promise<void> {
  if (typefaces.has(def.id)) return;
  const asset = Asset.fromModule(def.module);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = Skia.Data.fromBytes(base64ToBytes(base64));
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  if (tf) typefaces.set(def.id, tf);
}

export function ensureFontsLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all(FONTS.map((f) => loadOne(f).catch(() => {})))
      .then(() => undefined)
      .catch(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function isFontReady(id: FontId = DEFAULT_FONT_ID): boolean {
  return typefaces.has(id);
}

export function getTypeface(id: FontId): SkTypeface | null {
  return typefaces.get(id) ?? typefaces.get(DEFAULT_FONT_ID) ?? null;
}

export function fontFor(id: FontId, size: number): SkFont {
  const tf = getTypeface(id);
  if (tf) return Skia.Font(tf, size);
  try {
    const mgr = Skia.FontMgr.System();
    const fallback = mgr.matchFamilyStyle("", { weight: 700 });
    return Skia.Font(fallback ?? undefined, size);
  } catch {
    return Skia.Font(undefined, size);
  }
}
