/**
 * Small, pure text-anchoring helpers for the Frigo template parser.
 *
 * The template's text (as produced by pdf-parse) groups text by Y-position:
 * some labels and values sit on the same line and get concatenated, others
 * are split across separate lines and even reordered. These helpers cover the
 * two reliable strategies: "value that follows a known run of labels" and
 * "the line that contains a known marker".
 */

/** Split into trimmed, non-empty lines. */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Find a run of consecutive lines exactly matching `labels`, and return the
 * `count` lines immediately after it. Used for the header blocks where the
 * template prints all labels, then all values.
 */
export function valuesAfterLabelRun(
  lines: string[],
  labels: string[],
  count: number,
): string[] {
  const wanted = labels.map(norm);
  for (let i = 0; i + wanted.length <= lines.length; i++) {
    let matched = true;
    for (let j = 0; j < wanted.length; j++) {
      if (norm(lines[i + j]) !== wanted[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return lines.slice(i + wanted.length, i + wanted.length + count);
    }
  }
  return [];
}

/** First line containing `marker` (case-insensitive). */
export function lineContaining(lines: string[], marker: string): string | null {
  const m = marker.toLowerCase();
  return lines.find((l) => l.toLowerCase().includes(m)) ?? null;
}

/** First capture group of `re` against `text`, trimmed; null if no match. */
export function firstMatch(text: string, re: RegExp, group = 1): string | null {
  const m = text.match(re);
  return m && m[group] ? m[group].trim() : null;
}
