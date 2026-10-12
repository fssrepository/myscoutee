import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import {
  ActivityEventInfoCardMenuConverter,
  type ActivityEventInfoCardMenuSubject
} from './activity-event-info-card-menu.converter';

describe('ActivityEventInfoCardMenuConverter', () => {
  it('routes a draft admin through Manage Event only', () => {
    const subject: ActivityEventInfoCardMenuSubject = {
      menu: 'activity-event-card',
      id: 'event-1',
      status: 'DR',
      ownerUserId: 'organizer',
      adminIds: ['organizer'],
      activity: 1
    };

    const actionIds = ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'organizer'
    }).map(item => item.id);

    expect(actionIds).toContain('manageEvent');
    expect(actionIds).not.toContain('editEvent');
    expect(actionIds).not.toContain('view');
    expect(ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'organizer'
    }).find(item => item.id === 'manageEvent')?.counter).toEqual({ value: 1, max: 99 });
    expect(ActivityEventInfoCardMenuConverter.eventEditorAction(subject, {
      activeUserId: 'organizer'
    })).toBe('manage');
  });

  it('routes a participant through View Event only', () => {
    const subject: ActivityEventInfoCardMenuSubject = {
      menu: 'activity-event-card',
      id: 'event-1',
      status: 'A',
      ownerUserId: 'organizer',
      acceptedMemberUserIds: ['viewer']
    };

    const actionIds = ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'viewer'
    }).map(item => item.id);

    expect(actionIds).toContain('view');
    expect(actionIds).not.toContain('manageEvent');
    expect(actionIds).not.toContain('editEvent');
    expect(ActivityEventInfoCardMenuConverter.eventEditorAction(subject, {
      activeUserId: 'viewer'
    })).toBe('view');
  });

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

  it('offers restore for a trashed participant event', () => {
    const subject: ActivityEventInfoCardMenuSubject = {
      menu: 'activity-event-card',
      id: 'event-1',
      status: 'T',
      ownerUserId: 'organizer'
    };

    const actionIds = ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'viewer'
    }).map(item => item.id);

    expect(actionIds).toContain('restore');
  });

  it('offers restore for a trashed hosted event', () => {
    const subject: ActivityEventInfoCardMenuSubject = {
      menu: 'activity-event-card',
      id: 'event-1',
      status: 'T',
      ownerUserId: 'organizer'
    };

    const actionIds = ActivityEventInfoCardMenuConverter.convert(subject, {
      activeUserId: 'organizer'
    }).map(item => item.id);

    expect(actionIds).toContain('restore');
  });
});
