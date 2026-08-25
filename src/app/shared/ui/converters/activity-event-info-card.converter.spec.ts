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

  it('uses the standard clickable organizer avatar over the tournament card image', () => {
    const imageUrl = '/media/public?key=images/system/tournament-room/v1/large.webp';
    const card = ActivityEventInfoCardConverter.convert({
      id: 'random-room:event-1:stage-1:room-1',
      title: 'Tournament Group R1',
      eventType: 'tournament-room',
      creatorUserId: '',
      organizerUserId: 'casey',
      creatorName: 'Casey Bridge',
      creatorInitials: 'CB',
      creatorAvatarUrl: '/media/casey.webp',
      imageUrl,
      status: 'A'
    } as ActivityEventDTO);

    expect(card.imageUrl).toBe(imageUrl);
    expect(card.ownerUserId).toBe('casey');
    expect(card.surfaceTone).toBe('system');
    expect(card.leadingIcon?.icon).toBe('emoji_events');
    expect(card.mediaStart).toMatchObject({
      variant: 'avatar',
      imageUrl: '/media/casey.webp',
      interactive: true
    });
  });

  it('renders the persisted tournament stage as a separate card row', () => {
    const card = ActivityEventInfoCardConverter.convert({
      id: 'event-1',
      title: 'Tournament',
      startAtIso: '2026-08-16T12:00:00Z',
      endAtIso: '2026-08-16T18:00:00Z',
      currentStage: {
        id: 'final',
        name: 'Final',
        stageNumber: 2,
        totalStages: 2,
        status: 'A'
      }
    } as ActivityEventDTO, {
      translateParams: (_key, values) => `Current stage: ${values['stage']} · ${values['current']}/${values['total']}`
    });

    expect(card.metaRows?.[0]).toBe('Current stage: Final · 2/2');
  });
});
