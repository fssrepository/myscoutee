import { describe, expect, it } from 'vitest';

import type { ActivityEventDTO } from '../../core/contracts/activity.interface';
import { ActivityEventInfoCardConverter } from './activity-event-info-card.converter';

describe('ActivityEventInfoCardConverter activity badge', () => {
  it('projects pending event activity onto the three-dot menu badge', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'event-1',
      title: 'Seattle Wildflower Meetup',
      activity: 3
    } as ActivityEventDTO);

    expect(card.menuBadgeCount).toBe(3);
  });

  it('keeps pending members on the dedicated media badge instead of the menu badge', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'event-1',
      title: 'Seattle Wildflower Meetup',
      activity: 0,
      pendingMembers: 2
    } as ActivityEventDTO);

    expect(card.menuBadgeCount).toBe(0);
    expect(card.mediaEnd?.pendingCount).toBe(2);
  });

  it('uses the organizer profile image in a clickable avatar overlay', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'event-1',
      title: 'Seattle Wildflower Meetup',
      creatorUserId: 'organizer-1',
      creatorName: 'Kai Morgan',
      creatorInitials: 'KM',
      creatorAvatarUrl: '/media/kai.webp'
    } as ActivityEventDTO);

    expect(card.mediaStart).toMatchObject({
      variant: 'avatar',
      imageUrl: '/media/kai.webp',
      interactive: true
    });
  });

  it('renders a random room as a system-owned event rather than a user-owned event', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'random-room:event-1:stage-1:room-1',
      title: 'Random Room R1',
      eventType: 'random-room',
      creatorName: 'MyScoutee System',
      creatorAvatarUrl: '/unexpected-user-avatar.webp',
      imageUrl: '/media/public?key=images/system/random-room-default.png',
      status: 'A'
    } as ActivityEventDTO);

    expect(card.surfaceTone).toBe('system');
    expect(card.leadingIcon?.icon).toBe('auto_awesome');
    expect(card.mediaStart).toMatchObject({
      variant: 'badge',
      icon: 'auto_awesome',
      label: '',
      interactive: false
    });
  });
});
