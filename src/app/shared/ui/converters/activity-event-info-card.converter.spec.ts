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
});
