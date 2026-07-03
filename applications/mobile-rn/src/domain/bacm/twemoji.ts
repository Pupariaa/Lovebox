const U200D = "\u200D";
const UFE0F_GLOBAL = /\uFE0F/g;
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/";

function toCodePoints(text: string): string {
  const out: string[] = [];
  let high = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (high) {
      out.push((0x10000 + ((high - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      high = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      high = c;
    } else {
      out.push(c.toString(16));
    }
  }
  return out.join("-");
}

export function emojiToTwemojiRef(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const normalized = text.indexOf(U200D) < 0 ? text.replace(UFE0F_GLOBAL, "") : text;
  const cp = toCodePoints(normalized);
  if (!cp) return null;
  return `twemoji:${cp}`;
}

export function twemojiUrl(codePoints: string): string {
  return `${TWEMOJI_BASE}${codePoints}.png`;
}
