import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import {
  ActivityEventInfoCardMenuConverter,
  type ActivityEventInfoCardMenuSubject
} from './activity-event-info-card-menu.converter';

describe('ActivityEventInfoCardMenuConverter pending activity', () => {
  it('shows the pending counter on the view-event menu item', () => {
    const subject: ActivityEventInfoCardMenuSubject = {
      menu: 'activity-event-card',
      id: 'event-1',
      status: 'A',
      ownerUserId: 'organizer',
      acceptedMemberUserIds: ['viewer'],
      activity: 3,
      pendingMemberUserIds: Array.from({ length: 45 }, (_, index) => `pending-${index}`)
    };

    const viewItem = ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'viewer'
    }).find(item => item.id === 'view');

    expect(viewItem?.counter).toEqual({ value: 3, max: 99 });
    expect(viewItem?.counterTone).toBe('alert');
  });
});
