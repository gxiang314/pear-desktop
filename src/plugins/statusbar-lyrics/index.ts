import { t } from '@/i18n';
import { Platform } from '@/types/plugins';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { onMenu } from './menu';
import { renderer } from './renderer';

export interface StatusbarLyricsPluginConfig {
  enabled: boolean;
  /**
   * Width the title may occupy, in menu bar points. 0 means "auto": the
   * plugin sizes itself from the display and then narrows to whatever the
   * menu bar actually grants, which is what copes with a notch and with tray
   * icons that cannot be removed.
   */
  budgetPt: number;
  /**
   * Mark clipped lines with a trailing "…". Off by default: it costs roughly
   * a whole Chinese character of an already-tight bar, and a cut-off lyric
   * reads as cut off without it.
   */
  ellipsis: boolean;
}

export default createPlugin<
  typeof backend,
  unknown,
  typeof renderer,
  StatusbarLyricsPluginConfig
>({
  name: () => t('plugins.statusbar-lyrics.name'),
  description: () => t('plugins.statusbar-lyrics.description'),
  restartNeeded: true,
  addedVersion: '3.12.0',
  // `Tray.setTitle` is macOS-only; there is no menu bar text to write to
  // elsewhere, so the plugin is not offered on other platforms at all.
  platform: Platform.macOS,
  config: {
    enabled: false,
    budgetPt: 0,
    ellipsis: false,
  },

  menu: onMenu,
  backend,
  renderer,
});
