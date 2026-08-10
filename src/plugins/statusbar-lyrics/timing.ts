import type { LineLyrics } from '@/plugins/synced-lyrics/types';

/**
 * Returns the lyric line playing at `timeMs`.
 *
 * A line's `duration` runs right up to the next line's start (see the LRC
 * parser), so the active line is simply the last one whose start time has
 * passed. Checking against `duration` instead would blank the text during
 * every pause between lines. The parser inserts an empty line at 0 for the
 * intro, which naturally keeps the bar clear until the first real lyric.
 */
export const activeLine = (
  lines: LineLyrics[] | null,
  timeMs: number,
): string => {
  if (!lines?.length) return '';

  // Walking backwards avoids findLastIndex, absent from this lib target.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].timeInMs <= timeMs) return lines[i].text;
  }

  return '';
};
