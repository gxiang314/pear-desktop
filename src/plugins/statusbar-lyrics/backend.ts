import electron from 'electron';

import { createBackend } from '@/utils';

import { estimateWidthPt, fitLyric } from './format';

import type { StatusbarLyricsPluginConfig } from './index';
import type { BackendContext } from '@/types/contexts';

// Reached via the default export: named ESM imports of electron's CJS module
// are unreliable inside a lazily-imported plugin chunk.
const { nativeImage, screen, Tray } = electron;

// A dedicated tray with an empty image. The app's own tray only exists when
// the user turns it on, so this cannot piggyback on it.
let tray: electron.Tray | undefined;
let config: StatusbarLyricsPluginConfig;

/**
 * Points of menu bar the title is allowed to occupy.
 *
 * `budgetPt: 0` means "work it out": macOS gives no API for the free space,
 * but the tray reports its own bounds, so renders are measured and whatever
 * the system actually granted becomes the ceiling. On a notched Mac with
 * other icons present, that granted width is already the truncated one —
 * exactly the number we want to fit inside from then on.
 */
let measuredBudgetPt = 0;

let currentText = '';

const getTray = () => {
  tray ??= new Tray(nativeImage.createEmpty());
  return tray;
};

/**
 * A conservative starting budget: a share of the screen width, minus room for
 * the notch on displays that have one. Used until a real measurement lands.
 */
const initialBudgetPt = () => {
  const display = screen.getPrimaryDisplay();
  const { width } = display.bounds;
  // A taller-than-standard menu bar means a notch is eating the middle.
  const menuBarHeight = display.workArea.y - display.bounds.y;
  const hasNotch = menuBarHeight > 25;

  // Right-hand side only, and never more than a third of the bar, so system
  // items and other apps' icons keep their room.
  return Math.round(width / 3) - (hasNotch ? 120 : 0);
};

const budget = () =>
  config.budgetPt > 0 ? config.budgetPt : measuredBudgetPt || initialBudgetPt();

/** Writes the title, and learns from what the menu bar actually granted. */
const render = () => {
  const instance = getTray();
  const title = fitLyric(currentText, budget(), config.ellipsis);

  instance.setTitle(title);

  if (!title || config.budgetPt > 0) return;

  // A shortfall means the system clipped the item — usually the notch or a
  // crowded bar — so tighten the budget and let the next line fit properly.
  const granted = instance.getBounds().width;
  if (granted > 0 && granted < estimateWidthPt(title) - 2) {
    measuredBudgetPt = granted;
  }
};

export const backend = createBackend<
  { setText: (text: string) => void },
  StatusbarLyricsPluginConfig
>({
  setText(text: string) {
    currentText = text;
    render();
  },

  async start({
    getConfig,
    ipc: { on },
  }: BackendContext<StatusbarLyricsPluginConfig>) {
    config = await getConfig();

    on('statusbar-lyrics:set', (text: string) => {
      this.setText(text);
    });

    // A new display or resolution changes how much bar there is; re-measure.
    const remeasure = () => {
      measuredBudgetPt = 0;
    };
    screen.on('display-metrics-changed', remeasure);
    screen.on('display-added', remeasure);
    screen.on('display-removed', remeasure);
  },

  stop() {
    tray?.destroy();
    tray = undefined;
    measuredBudgetPt = 0;
    currentText = '';
  },

  onConfigChange(newConfig: StatusbarLyricsPluginConfig) {
    config = newConfig;
    // A width change should take effect on the current line, not the next one.
    measuredBudgetPt = 0;
    render();
  },
});
