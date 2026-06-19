import type { AppMenuItem, AppMenuPalette } from '../menu';
import {
  CARD_MENU_ACTIONS,
  type CardMenuAction,
  type CardResolvedMenuAction
} from './card.types';

export interface CardActionMenuItemContext<TCard = unknown> {
  menu: 'card-actions';
  card?: TCard | null;
  action: CardResolvedMenuAction;
}

export function cardMenuItemsForActions<TCard = unknown>(
  actions: readonly CardMenuAction[] | null | undefined,
  card?: TCard | null
): readonly AppMenuItem<string, CardActionMenuItemContext<TCard>>[] {
  return (actions ?? []).flatMap(actionId => {
    const config = CARD_MENU_ACTIONS[actionId];
    if (!config) {
      return [];
    }
    const action: CardResolvedMenuAction = {
      id: actionId,
      ...config
    };
    return [{
      id: actionId,
      label: config.label,
      icon: config.icon,
      palette: cardMenuActionPalette(config.tone),
      surface: 'tinted',
      context: {
        menu: 'card-actions',
        card,
        action
      }
    }];
  });
}

export function cardMenuActionPalette(tone: CardResolvedMenuAction['tone']): AppMenuPalette {
  switch (tone) {
    case 'accent':
      return 'brown';
    case 'warning':
    case 'review':
      return 'orange';
    case 'destructive':
      return 'danger';
    default:
      return 'default';
  }
}
