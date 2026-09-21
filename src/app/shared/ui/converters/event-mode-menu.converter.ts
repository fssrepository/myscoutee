import type { EventMode } from '../../core/contracts/event.interface';
import type { AppMenuItem, AppMenuTrigger } from '../components/core/menu/menu.types';

const OPTIONS = [
  { id: 'Casual', label: 'event.mode.standard', icon: 'groups', palette: 'slate' },
  { id: 'Tournament', label: 'event.mode.tournament', icon: 'emoji_events', palette: 'cyan' },
  { id: 'Mingle', label: 'event.mode.mingle', icon: 'table_restaurant', palette: 'rose' }
] as const;

export class EventModeMenuConverter {
  static trigger(mode: EventMode | ''): AppMenuTrigger {
    const option = OPTIONS.find(item => item.id === mode);
    return { label: option?.label ?? 'any', icon: option?.icon ?? 'category',
      palette: option?.palette ?? 'slate', layout: 'field' };
  }

  static items(mode: EventMode | '', includeAny = false): readonly AppMenuItem<EventMode | '', unknown>[] {
    const options = includeAny
      ? [{ id: '' as const, label: 'any', icon: 'category', palette: 'slate' as const }, ...OPTIONS]
      : OPTIONS;
    return options.map(option => ({ ...option, kind: 'radio', surface: 'tinted',
      active: option.id === mode, checked: option.id === mode }));
  }
}
