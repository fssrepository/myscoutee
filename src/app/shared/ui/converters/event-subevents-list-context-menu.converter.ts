import type { AppMenuItem } from '../components/core/menu';
import type { UiConverter } from './converter.types';

export type EventSubeventsListContextAction =
  | 'participantFilter'
  | 'edit'
  | 'manage'
  | 'view'
  | 'members';

export interface EventSubeventsListContextMenuContext {
  menu: 'context';
  action: EventSubeventsListContextAction;
}

export interface EventSubeventsListContextMenuConverterInput {
  participantOnly: boolean;
  editorAction: 'edit' | 'manage' | 'view';
  pendingMembers: number;
  membersDisabled: boolean;
}

export class EventSubeventsListContextMenuConverter
  implements UiConverter<
    EventSubeventsListContextMenuConverterInput,
    readonly AppMenuItem<string, EventSubeventsListContextMenuContext>[]
  > {
  static convert(
    input: EventSubeventsListContextMenuConverterInput
  ): readonly AppMenuItem<string, EventSubeventsListContextMenuContext>[] {
    const pendingMembers = this.nonNegativeInteger(input.pendingMembers);
    const canEditStructure = input.editorAction === 'edit';
    return [
      {
        id: 'participant-filter',
        label: 'event.subevents.my.participation',
        icon: input.participantOnly ? 'person_pin_circle' : 'person_pin',
        kind: 'toggle',
        layout: 'pill',
        active: input.participantOnly,
        checked: input.participantOnly,
        closeOnSelect: false,
        palette: 'green',
        context: { menu: 'context', action: 'participantFilter' }
      },
      {
        id: input.editorAction,
        label: canEditStructure ? 'edit' : 'view',
        icon: canEditStructure ? 'edit' : 'visibility',
        palette: canEditStructure ? 'amber' : 'teal',
        surface: 'tinted',
        layout: 'action',
        context: { menu: 'context', action: input.editorAction }
      },
      {
        id: 'members',
        label: 'members',
        icon: 'groups',
        palette: 'violet',
        surface: 'tinted',
        layout: 'action',
        disabled: input.membersDisabled,
        counter: pendingMembers > 0 ? { value: pendingMembers, max: 99 } : null,
        counterTone: 'alert',
        context: { menu: 'context', action: 'members' }
      }
    ];
  }

  convert(
    input: EventSubeventsListContextMenuConverterInput
  ): readonly AppMenuItem<string, EventSubeventsListContextMenuContext>[] {
    return EventSubeventsListContextMenuConverter.convert(input);
  }

  private static nonNegativeInteger(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  }
}

export const eventSubeventsListContextMenuConverter =
  EventSubeventsListContextMenuConverter satisfies UiConverter<
    EventSubeventsListContextMenuConverterInput,
    readonly AppMenuItem<string, EventSubeventsListContextMenuContext>[]
  >;
