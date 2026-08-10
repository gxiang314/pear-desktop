/**
 * Measured on a notched MacBook (menu bar 30pt, scale 2) by rendering strings
 * into a real tray and reading `getBounds().width`:
 *
 *     ""                ->  17pt      (fixed item padding)
 *     "a" .. "abcdefgh" ->  28..78pt  (~6.4pt per latin char)
 *     "月" .. "月亮代表我的心" ->  33..111pt (~13pt per CJK char)
 *
 * So a CJK glyph costs about twice a latin one, and there is a constant
 * ~17pt of chrome around the title.
 */
// 17pt was measured for an empty title, but fitted strings then rendered a
// consistent ~6pt wider than estimated, so the real per-item chrome is nearer
// 23pt. Erring high keeps the result inside its budget instead of overrunning.
const ITEM_PADDING_PT = 23;
const LATIN_PT = 6.4;
const CJK_PT = 13;

const isWide = (char: string) => {
  const code = char.codePointAt(0) ?? 0;

  return (
    // CJK ideographs, kana, Hangul, and full-width forms.
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
};

// Emoji render a touch wider than a CJK glyph, and a grapheme cluster may
// carry modifiers (skin tone, ZWJ sequences) that add nothing to `isWide`.
const EMOJI_PT = 16;

const isEmoji = (char: string) => /\p{Extended_Pictographic}/u.test(char);

const charWidthPt = (char: string) => {
  if (isEmoji(char)) return EMOJI_PT;

  return isWide(char) ? CJK_PT : LATIN_PT;
};

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Splits into user-perceived characters, so a cut never lands inside an emoji
 * or a combining mark. Plain spreading would tear them apart.
 */
const graphemesOf = (text: string): string[] =>
  Array.from(segmenter.segment(text), (entry) => entry.segment);

/** Estimated rendered width of a full title, including item padding. */
export const estimateWidthPt = (text: string): number => {
  if (!text) return ITEM_PADDING_PT;

  let width = ITEM_PADDING_PT;
  for (const char of graphemesOf(text)) width += charWidthPt(char);

  return Math.round(width);
};

/** Measured: "…" adds ~10pt, close to a whole CJK glyph rather than a latin one. */
const ELLIPSIS_PT = 10;

/**
 * Trims `text` so its rendered title fits within `budgetPt` points. Budget is
 * in menu bar points, not characters, because that is what actually runs out —
 * a line of Chinese is twice as wide as the same number of latin characters,
 * and the notch plus other tray icons eat the space before a character count
 * would notice.
 *
 * `withEllipsis` is off by default: on a bar this tight the marker costs
 * roughly a full Chinese character, and a clipped lyric already reads as
 * clipped, so the space buys more as text.
 */
export const fitLyric = (
  text: string,
  budgetPt: number,
  withEllipsis = false,
): string => {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (!cleaned || budgetPt <= ITEM_PADDING_PT) return '';
  if (estimateWidthPt(cleaned) <= budgetPt) return cleaned;

  const limit = budgetPt - ITEM_PADDING_PT - (withEllipsis ? ELLIPSIS_PT : 0);

  let out = '';
  let used = 0;
  for (const char of graphemesOf(cleaned)) {
    const next = used + charWidthPt(char);
    if (next > limit) break;
    out += char;
    used = next;
  }

  const trimmed = out.trimEnd();

  if (!trimmed) return '';

  return withEllipsis ? `${trimmed}…` : trimmed;
};
