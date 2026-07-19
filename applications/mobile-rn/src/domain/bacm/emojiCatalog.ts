export type BundledEmoji = {
  ref: string;
  label: string;
  folder: string;
  animated: boolean;
};

export const BUNDLED_EMOJIS: BundledEmoji[] = [
  { ref: "emoji:1f48c", label: "Lettre", folder: "1f48c", animated: true },
  { ref: "emoji:1f329-fe0f", label: "Eclair", folder: "1f329_fe0f", animated: true },
  { ref: "emoji:1f389", label: "Fete", folder: "1f389_w_w_mqzx3u1111", animated: true },
  { ref: "emoji:1f446", label: "Doigt", folder: "1f446", animated: true },
  { ref: "emoji:1f614", label: "Pensif", folder: "1f614_w_w_mqzxkguj1c", animated: true },
  { ref: "emoji:1f42c", label: "Panda", folder: "1f42c_w_w_mqzxq5g01i", animated: true },
  { ref: "emoji:1f446-1f3fb", label: "Doigt clair", folder: "1f446_1f3fb_w_w_mqzwncruk", animated: true },
  { ref: "glyphs:sparkles", label: "Etincelles", folder: "glyphs_sparkles", animated: false },
  { ref: "glyphs:arrows_round", label: "Fleches", folder: "glyphs_arrows_round", animated: false },
  { ref: "glyphs:comment_info", label: "Info", folder: "glyphs_comment_info", animated: false },
  { ref: "glyphs:watch", label: "Montre", folder: "glyphs_watch", animated: false },
];

export const COMPOSER_COLOR_PALETTE = [
  "#000000",
  "#FFFFFF",
  "#8A8F98",
  "#2E141C",
  "#120310",
  "#FF2E43",
  "#FF6B8A",
  "#E85D75",
  "#B84D62",
  "#FF7A00",
  "#FFB020",
  "#FFD400",
  "#7ED957",
  "#2EAD5B",
  "#00B3A6",
  "#33C3F0",
  "#2E7BFF",
  "#4A3AFF",
  "#8A4DFF",
  "#C74DFF",
  "#FF4DD2",
  "#FFC7CE",
  "#FFE6A7",
  "#C9F5C0",
  "#B7E7FF",
  "#E0D4FF",
  "#F5E1D0",
  "#E09090",
  "#5A3848",
  "#4A3040",
];

export function resolveEmojiFolder(ref: string): string | null {
  const direct = BUNDLED_EMOJIS.find((e) => e.ref === ref);
  if (direct) return direct.folder;
  const normalized = ref.replace(/^emoji:/, "").toLowerCase().replace(/-/g, "_");
  const match = BUNDLED_EMOJIS.find(
    (e) => e.ref.replace(/^emoji:/, "").replace(/-/g, "_") === normalized,
  );
  return match ? match.folder : null;
}
