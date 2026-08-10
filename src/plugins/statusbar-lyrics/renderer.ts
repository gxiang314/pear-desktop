import { t } from '@/i18n';
import { createRenderer } from '@/utils';

import { activeLine } from './timing';

import type { StatusbarLyricsPluginConfig } from './index';
import type { LineLyrics } from '@/plugins/synced-lyrics/types';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

type LyricsStoreModule =
  typeof import('@/plugins/synced-lyrics/renderer/store');

/**
 * Reads synced-lyrics' own store rather than scraping the lyrics DOM, so this
 * works no matter which tab is open and does not break when that markup
 * changes. Resolved once; null when synced-lyrics is unavailable.
 */
let store: LyricsStoreModule | null = null;
let api: MusicPlayer | null = null;

const getLines = (): LineLyrics[] | null =>
  store?.lyricsStore.current?.data?.lines ?? null;

/**
 * What to show when there is no synced line to display. Distinguishes "still
 * searching" from "there really are none", so the bar does not claim a song
 * has no lyrics while the providers are still being queried.
 */
const emptyStateText = (): string => {
  const current = store?.lyricsStore.current;

  // synced-lyrics missing or nothing loaded yet: stay silent rather than
  // reporting on a state we cannot actually see.
  if (!current) return '';

  if (current.state === 'fetching') return '';
  if (current.state === 'error') return t('plugins.statusbar-lyrics.error');

  // Done, but the provider returned nothing usable for this track.
  if (!current.data?.lines?.length && !current.data?.lyrics) {
    return t('plugins.statusbar-lyrics.no-lyrics');
  }

  // Lyrics exist but this moment falls in an instrumental gap — blank is right.
  return '';
};

export const renderer = createRenderer<
  { timer?: ReturnType<typeof setInterval> },
  StatusbarLyricsPluginConfig
>({
  async start({ ipc }: RendererContext<StatusbarLyricsPluginConfig>) {
    try {
      store = await import('@/plugins/synced-lyrics/renderer/store');
    } catch {
      store = null;
    }

    let last: string | null = null;

    this.timer = setInterval(() => {
      // Paused counts as "keep showing the current line" — the menu bar should
      // not blank out just because playback stopped.
      const line = activeLine(getLines(), (api?.getCurrentTime() ?? 0) * 1000);
      const text = line || emptyStateText();

      // Only cross IPC when the line actually changes, not ten times a second.
      if (text === last) return;

      last = text;
      ipc.send('statusbar-lyrics:set', text);
    }, 100);
  },

  onPlayerApiReady(playerApi: MusicPlayer) {
    api = playerApi;
  },

  stop({ ipc }: RendererContext<StatusbarLyricsPluginConfig>) {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    ipc.send('statusbar-lyrics:set', '');
  },
});
