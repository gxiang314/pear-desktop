import { t } from '@/i18n';

import type { StatusbarLyricsPluginConfig } from './index';
import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

// Width in menu bar points. Roughly 8 / 12 / 18 / 25 Chinese characters.
const WIDTHS = [120, 180, 260, 350];

export const onMenu = async ({
  getConfig,
  setConfig,
}: MenuContext<StatusbarLyricsPluginConfig>): Promise<MenuTemplate> => {
  const config = await getConfig();

  return [
    {
      label: t('plugins.statusbar-lyrics.menu.ellipsis'),
      type: 'checkbox',
      checked: config.ellipsis,
      click(item) {
        setConfig({ ellipsis: item.checked });
      },
    },
    {
      label: t('plugins.statusbar-lyrics.menu.width.label'),
      submenu: [
        {
          label: t('plugins.statusbar-lyrics.menu.width.auto'),
          type: 'radio' as const,
          checked: config.budgetPt === 0,
          click() {
            setConfig({ budgetPt: 0 });
          },
        },
        ...WIDTHS.map((budgetPt) => ({
          label: t('plugins.statusbar-lyrics.menu.width.points', {
            points: budgetPt,
          }),
          type: 'radio' as const,
          checked: config.budgetPt === budgetPt,
          click() {
            setConfig({ budgetPt });
          },
        })),
      ],
    },
  ];
};
