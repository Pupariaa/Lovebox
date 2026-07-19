// Regenerates src/data/fluent-emoji-manifest.json with the full set of animated Fluent emoji.
//
// Source of the animated PNGs: bignutty/fluent-emoji (CDN-friendly, non-LFS repackage of
// Microsoft's animated Fluent emoji, served by jsDelivr). Microsoft's own repo
// (microsoft/fluentui-emoji-animated) stores the same art in Git LFS at ~1.5 MB / emoji with no
// public CDN, so it cannot be hotlinked from the app; bignutty exposes the identical animations.
//
// Labels / categories / search keywords come from emojibase-data, keyed by unicode codepoint.
//
// Run: node scripts/build-emoji-manifest.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "fluent-emoji-manifest.json");

const TREE_URL =
  "https://api.github.com/repos/bignutty/fluent-emoji/git/trees/main?recursive=1";
const EMOJIBASE_URL =
  "https://cdn.jsdelivr.net/npm/emojibase-data@latest/en/compact.json";
const CDN = "https://cdn.jsdelivr.net/gh/bignutty/fluent-emoji@main/animated/";

const GROUP_TO_SLUG = {
  0: "smileys-&-emotion",
  1: "people-&-body",
  2: "other",
  3: "animals-&-nature",
  4: "food-&-drink",
  5: "travel-&-places",
  6: "activities",
  7: "objects",
  8: "symbols",
  9: "flags",
};

const norm = (hex) => hex.toLowerCase().replace(/-/g, "_");
const stripFe0f = (id) => id.split("_").filter((p) => p !== "fe0f").join("_");

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "lovebox-emoji-build" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function buildMetaIndex(data) {
  const meta = new Map();
  const put = (id, entry) => {
    if (!meta.has(id)) meta.set(id, entry);
    const bare = stripFe0f(id);
    if (bare && !meta.has(bare)) meta.set(bare, entry);
  };
  for (const e of data) {
    const entry = {
      group: e.group ?? 8,
      label: e.label,
      keywords: Array.isArray(e.tags) ? e.tags.join(" ") : "",
    };
    put(norm(e.hexcode), entry);
    for (const skin of e.skins ?? []) {
      put(norm(skin.hexcode), {
        group: entry.group,
        label: skin.label || entry.label,
        keywords: Array.isArray(skin.tags) ? skin.tags.join(" ") : entry.keywords,
      });
    }
  }
  return meta;
}

function lookup(meta, rawId) {
  const id = norm(rawId);
  return meta.get(id) || meta.get(stripFe0f(id)) || null;
}

async function main() {
  console.log("Fetching bignutty file tree...");
  const tree = await getJson(TREE_URL);
  // Skin-tone modifiers (1F3FB..1F3FF) produce 5+ near-duplicate variants of every person emoji,
  // which would flood the picker. Keep only the default (non-modified) glyph.
  const SKIN_TONE = /(?:^|[-_])(1f3fb|1f3fc|1f3fd|1f3fe|1f3ff)(?:[-_]|$)/;
  const files = tree.tree
    .filter((n) => n.path.startsWith("animated/") && n.path.endsWith(".png"))
    .map((n) => n.path.slice("animated/".length))
    .filter((f) => !SKIN_TONE.test(f.replace(/\.png$/, "")))
    .sort();
  console.log(`Found ${files.length} animated PNGs (skin-tone variants excluded)`);

  console.log("Fetching emojibase metadata...");
  const meta = buildMetaIndex(await getJson(EMOJIBASE_URL));

  const icons = [];
  const categoriesSeen = new Set();
  let matched = 0;
  for (const file of files) {
    const id = file.replace(/\.png$/, "");
    const m = lookup(meta, id);
    const category = m ? GROUP_TO_SLUG[m.group] ?? "other" : "other";
    const label = m ? m.label : id.replace(/_/g, " ");
    if (m) matched++;
    categoriesSeen.add(category);
    const icon = { id, label, category, file };
    if (m && m.keywords) icon.keywords = m.keywords;
    icons.push(icon);
  }

  const manifest = {
    id: "fluent",
    label: "Fluent Emojis",
    refPrefix: "emoji:",
    source: "https://github.com/microsoft/fluentui-emoji-animated",
    cdn: CDN,
    license: "MIT",
    animated: true,
    size: 32,
    count: icons.length,
    categories: [...categoriesSeen].sort(),
    icons,
  };

  writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Wrote ${icons.length} icons (${matched} with metadata, ${icons.length - matched} fallback) to ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
