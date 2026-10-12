import { describe, expect, it } from 'vitest';

import { UserRealtimeUiConverter } from './user-realtime-ui.converter';

describe('UserRealtimeUiConverter impression changes', () => {
  it('does not infer an Impressions badge from the payload when the authoritative flags are false', () => {
    const patch = UserRealtimeUiConverter.convert({
      snapshot: snapshot(false),
      currentChangeFlags: { host: false, member: false },
      suppressImpressionBadges: false
    });

    expect(patch.changeFlags).toEqual({ host: false, member: false });
  });

  it('uses the authoritative poll flag and keeps an already raised flag sticky', () => {
    const patch = UserRealtimeUiConverter.convert({
      snapshot: snapshot(true),
      currentChangeFlags: { host: true, member: false },
      suppressImpressionBadges: false
    });

    expect(patch.changeFlags).toEqual({ host: true, member: true });
  });
});

function snapshot(memberChanged: boolean) {
  return {
    userId: 'riley',
    counters: {
      impressionsHostChanged: false,
      impressionsMemberChanged: memberChanged
    },
    impressions: {
      member: {
        unreadCount: 0,
        personalityBadges: ['Adventurer 56%']
      }
    },
    cursor: 'riley:cursor'
  };
}
