/**
 * Splits French text into sentences suitable for TTS.
 * Handles common French abbreviations (M., Mme., Dr., etc.)
 * and merges very short segments to avoid tiny TTS calls.
 */

const ABBREV_RE = /\b(?:M|Mme|Mlle|Dr|St|Ste|Prof|Sr|Jr|etc|cf|vol|chap|fig|av|apr|env|min|max|nb|no|ex)\.\s*$/i;

const MIN_SENTENCE_LENGTH = 10;

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Use regex to find sentence boundaries:
  // Punctuation (.!?…) or (...) followed by a space
  const re = /([.!?\u2026]|\.{3})\s+/g;
  const raw: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(trimmed)) !== null) {
    const candidate = trimmed.slice(lastIndex, match.index + match[1].length);

    // Don't split on abbreviations (only for single dots, not ! ? or ...)
    if (match[1] === "." && ABBREV_RE.test(candidate)) {
      continue;
    }

    raw.push(candidate.trim());
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  const rest = trimmed.slice(lastIndex).trim();
  if (rest) {
    raw.push(rest);
  }

  // Merge short segments: forward into next, or backward into previous
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let segment = raw[i];
    while (segment.length < MIN_SENTENCE_LENGTH && i + 1 < raw.length) {
      i++;
      segment += " " + raw[i];
    }
    // If still short and there's a previous segment, merge backward
    if (segment.length < MIN_SENTENCE_LENGTH && merged.length > 0) {
      merged[merged.length - 1] += " " + segment;
    } else {
      merged.push(segment);
    }
  }

  return merged;
}
