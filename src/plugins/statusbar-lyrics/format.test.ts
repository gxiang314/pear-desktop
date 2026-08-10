import { expect, test } from '@playwright/test';

import { estimateWidthPt, fitLyric } from './format';
import { activeLine } from './timing';

import type { LineLyrics } from '@/plugins/synced-lyrics/types';

test('collapses whitespace and passes text that already fits', () => {
  expect(fitLyric('  hello   world  ', 300)).toBe('hello world');
});

test('empty input stays empty', () => {
  expect(fitLyric('', 300)).toBe('');
  expect(fitLyric('   ', 300)).toBe('');
});

test('a budget smaller than the item padding shows nothing', () => {
  expect(fitLyric('anything', 0)).toBe('');
  expect(fitLyric('anything', 10)).toBe('');
});

test('a budget too tight for even one glyph shows nothing, not a lone ellipsis', () => {
  expect(fitLyric('月亮代表我的心', 20)).toBe('');
});

test('clips without a marker by default', () => {
  const out = fitLyric('abcdefghijklmnop', 60);
  expect(out.endsWith('…')).toBe(false);
  expect(out.length).toBeLessThan('abcdefghijklmnop'.length);
});

test('adds the marker only when asked', () => {
  const out = fitLyric('abcdefghijklmnop', 60, true);
  expect(out.endsWith('…')).toBe(true);
});

test('the marker buys its own room rather than overflowing', () => {
  const long = '你問我愛你有多深我愛你有幾分你去想一想';

  for (const budget of [60, 120, 180, 260]) {
    const marked = fitLyric(long, budget, true);
    expect(estimateWidthPt(marked)).toBeLessThanOrEqual(budget);
    // ...and it costs text: the marked form carries fewer lyric characters.
    expect(marked.replace('…', '').length).toBeLessThanOrEqual(
      fitLyric(long, budget).length,
    );
  }
});

test('the result always fits inside the budget', () => {
  for (const budget of [40, 60, 120, 180, 260]) {
    const out = fitLyric('你問我愛你有多深我愛你有幾分你去想一想', budget);
    expect(estimateWidthPt(out)).toBeLessThanOrEqual(budget);
  }
});

// Anchored to real measurements taken from a live tray on a notched Mac.
test('width estimates meet or exceed the measured rendering', () => {
  // Estimates must never come in UNDER the real width, or the title overruns
  // its budget and the system hides it — the bug this guards against.
  // Measured on a live tray: 111pt and 88pt respectively.
  expect(estimateWidthPt('月亮代表我的心')).toBeGreaterThanOrEqual(111);
  expect(estimateWidthPt('Hello world')).toBeGreaterThanOrEqual(88);
  // ...but stay in the same ballpark, or the bar is needlessly short.
  expect(estimateWidthPt('月亮代表我的心')).toBeLessThanOrEqual(111 + 15);
  expect(estimateWidthPt('Hello world')).toBeLessThanOrEqual(88 + 15);
});

test('CJK costs about twice a latin character', () => {
  const cjk = estimateWidthPt('月亮代表') - 17;
  const latin = estimateWidthPt('abcd') - 17;
  expect(cjk / latin).toBeGreaterThan(1.7);
  expect(cjk / latin).toBeLessThan(2.3);
});

test('truncation never splits an emoji in half', () => {
  const long =
    '\u{1F3B5}\u4f60\u554f\u6211\u611b\u4f60\u6709\u591a\u6df1\u6211\u611b\u4f60\u6709\u5e7e\u5206\u4f60\u53bb\u60f3\u4e00\u60f3\u{1F44B}\u4f60\u53bb\u770b\u4e00\u770b';

  for (let budgetPt = 30; budgetPt < 220; budgetPt += 7) {
    const out = fitLyric(long, budgetPt);
    // A lone surrogate would mean a split emoji.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false);
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  }
});

const line = (timeInMs: number, text: string): LineLyrics => ({
  time: '',
  timeInMs,
  duration: 0,
  text,
  status: 'upcoming',
});

// Mirrors the LRC parser: an empty intro line at 0.
const LINES = [line(0, ''), line(1000, 'first'), line(5000, 'second')];

test('no lyrics yields an empty title', () => {
  expect(activeLine(null, 500)).toBe('');
  expect(activeLine([], 500)).toBe('');
});

test('the intro line keeps the bar blank', () => {
  expect(activeLine(LINES, 500)).toBe('');
});

test('shows the active line', () => {
  expect(activeLine(LINES, 2000)).toBe('first');
});

test('a line holds through the pause until the next starts', () => {
  // The case that previously blanked the text mid-song.
  expect(activeLine(LINES, 4999)).toBe('first');
  expect(activeLine(LINES, 5000)).toBe('second');
});

test('the final line persists to the end', () => {
  expect(activeLine(LINES, 999_999)).toBe('second');
});
