import { GROUP_TYPES, type GroupType } from '../../../core/contracts/group-type';
import type { AppMenuItem, AppMenuPalette, AppMenuTrigger } from '@fssrepository/myscoutee-components';

export const GROUP_TYPE_STYLES = {
  dating: { icon: 'favorite', palette: 'rose', accentHue: 340 },
  work: { icon: 'work', palette: 'blue', accentHue: 215 },
  community: { icon: 'diversity_3', palette: 'green', accentHue: 140 }
} as const satisfies Record<GroupType, { icon: string; palette: AppMenuPalette; accentHue: number }>;
export function groupTypeTrigger(type: GroupType) {
  const { icon, palette } = GROUP_TYPE_STYLES[type];
  return { label: `group.type.${type}`, icon, palette, layout: 'pill' } satisfies AppMenuTrigger;
}
export function groupTypeMenuItems(selected: GroupType): AppMenuItem[] {
  return GROUP_TYPES.map(id => {
    const { label, icon, palette } = groupTypeTrigger(id);
    return { id, value: id, label, icon, palette,
      kind: 'radio', active: id === selected, checked: id === selected, showCheck: true, surface: 'tinted' };
  });
}
