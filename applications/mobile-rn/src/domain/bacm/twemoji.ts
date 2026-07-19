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

// Matches flag pairs (regional indicators) and pictographic emoji with optional variation
// selectors, skin-tone modifiers and ZWJ sequences.
const EMOJI_REGEX =
  /\p{RI}\p{RI}|\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|[\uFE0F\u{1F3FB}-\u{1F3FF}\u20E3])*/gu;

export function hasEmoji(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

export type TextSegment = { kind: "text"; value: string } | { kind: "emoji"; ref: string };

// Splits a string into plain-text runs and emoji runs (each emoji carries its twemoji ref) so the
// rasterizer can draw text with the app font and emoji as bitmaps, avoiding tofu boxes.
export function segmentEmojiText(input: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  EMOJI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMOJI_REGEX.exec(input)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", value: input.slice(last, match.index) });
    }
    const ref = emojiToTwemojiRef(match[0]);
    if (ref) {
      segments.push({ kind: "emoji", ref });
    } else {
      segments.push({ kind: "text", value: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    segments.push({ kind: "text", value: input.slice(last) });
  }
  return segments;
}

export function twemojiRefToCodePoints(ref: string): string {
  return ref.startsWith("twemoji:") ? ref.slice("twemoji:".length) : ref;
}
