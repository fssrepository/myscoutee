import { describe, expect, it } from 'vitest';

import { EventSubeventsListContextMenuConverter } from './event-subevents-list-context-menu.converter';

describe('EventSubeventsListContextMenuConverter member activity', () => {
  it('puts only pending members on the Tags action as a red counter', () => {
    const members = EventSubeventsListContextMenuConverter.convert({
      participantOnly: false,
      editorAction: 'view',
      pendingMembers: 45,
      membersDisabled: false
    }).find(item => item.id === 'members');

    expect(members?.counter).toEqual({ value: 45, max: 99 });
    expect(members?.counterTone).toBe('alert');
  });
});
