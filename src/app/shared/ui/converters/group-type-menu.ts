import { GROUP_TYPES, type GroupType } from '../../core/contracts/group-type';
import type { AppMenuItem, AppMenuPalette, AppMenuTrigger } from '../components/core/menu';

const STYLES: Record<GroupType, { icon: string; palette: AppMenuPalette }> = {
  dating: { icon: 'favorite', palette: 'rose' },
  work: { icon: 'work', palette: 'blue' },
  community: { icon: 'diversity_3', palette: 'green' }
};
export function groupTypeTrigger(type: GroupType): AppMenuTrigger {
  return { label: `group.type.${type}`, ...STYLES[type], layout: 'pill' };
}
export function groupTypeMenuItems(selected: GroupType): AppMenuItem[] {
  return GROUP_TYPES.map(id => ({ id, value: id, label: `group.type.${id}`, ...STYLES[id],
    kind: 'radio', active: id === selected, checked: id === selected, showCheck: true, surface: 'tinted' }));
}
