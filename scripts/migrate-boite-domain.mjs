#!/usr/bin/env node
// Find or replace boite-a-coeur.techalchemy.fr -> boite-a-coeur.fr across the repo.
//
// Usage:
//   node scripts/migrate-boite-domain.mjs          # list matches
//   node scripts/migrate-boite-domain.mjs --apply  # replace in place

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OLD = "boite-a-coeur.techalchemy.fr";
const NEW = "boite-a-coeur.fr";
const APPLY = process.argv.includes("--apply");

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "build",
  ".gradle",
  ".expo",
  ".cxx",
  "archives",
  ".idea",
  "__pycache__",
]);

const SKIP_EXT = new Set([
  ".bin",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ttf",
  ".woff",
  ".woff2",
  ".rgb565",
  ".bacassets",
  ".keystore",
  ".jks",
  ".zip",
  ".apk",
  ".aab",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(ROOT, path);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    if (SKIP_EXT.has(ext.toLowerCase())) continue;
  if (relative(ROOT, path).replace(/\\/g, "/") === "scripts/migrate-boite-domain.mjs") continue;
  out.push(path);
  }
  return out;
}

const matches = [];

for (const file of walk(ROOT)) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!text.includes(OLD)) continue;
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (line.includes(OLD)) hits.push({ line: i + 1, text: line.trim() });
  });
  matches.push({ file: relative(ROOT, file), hits, text });
}

if (!APPLY) {
  let total = 0;
  for (const m of matches) {
    for (const h of m.hits) {
      console.log(`${m.file}:${h.line}: ${h.text}`);
      total++;
    }
  }
  console.log(`\n${matches.length} files, ${total} lines with "${OLD}"`);
  if (total > 0) console.log(`Run with --apply to replace with "${NEW}"`);
  process.exit(total > 0 ? 0 : 0);
}

let changed = 0;
for (const m of matches) {
  const next = m.text.split(OLD).join(NEW);
  if (next !== m.text) {
    writeFileSync(join(ROOT, m.file), next, "utf8");
    changed++;
    console.log(`updated ${m.file}`);
  }
}
console.log(`\n${changed} files updated`);
