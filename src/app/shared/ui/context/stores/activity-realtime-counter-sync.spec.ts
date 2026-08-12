import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { UserRealtimeLongPollResponseDto } from '../../../core/contracts/user.interface';
import { ActivityStore } from './activity.store';
import { UserProfileStore } from './user-profile.store';

describe('realtime activity counter synchronization', () => {
  let activityStore: ActivityStore;
  let userProfileStore: UserProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ActivityStore, UserProfileStore]
    });
    activityStore = TestBed.inject(ActivityStore);
    userProfileStore = TestBed.inject(UserProfileStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('applies ticket counters while leaving the deferred profile cursor untouched', () => {
    const token = activityStore.captureUserCounterSyncToken('user-1');

    expect(userProfileStore.applyUserRealtimeCounters('user-1', snapshot(1), token)).toBe(true);
    expect(activityStore.getUserCounterOverride('user-1', 'tickets')).toBe(1);
    expect(activityStore.getUserCounterOverrides('user-1').asset?.tickets).toBe(1);
    expect(userProfileStore.getUserRealtimeCursor('user-1')).toBeNull();
  });

  it('rejects a response captured before a newer local counter mutation', () => {
    const staleToken = activityStore.captureUserCounterSyncToken('user-1');
    activityStore.setUserCounterOverride('user-1', 'tickets', 2);

    expect(userProfileStore.applyUserRealtimeCounters('user-1', snapshot(1), staleToken)).toBe(false);
    expect(activityStore.getUserCounterOverride('user-1', 'tickets')).toBe(2);
  });

  it('invalidates an in-flight response when its user counters are cleared', () => {
    activityStore.setUserCounterOverride('user-1', 'tickets', 2);
    const staleToken = activityStore.captureUserCounterSyncToken('user-1');
    activityStore.clearUserCounterOverrides('user-1');

    expect(userProfileStore.applyUserRealtimeCounters('user-1', snapshot(1), staleToken)).toBe(false);
    expect(activityStore.getUserCounterOverride('user-1', 'tickets')).toBeNull();
  });
});

function snapshot(ticketCount: number): UserRealtimeLongPollResponseDto {
  return {
    userId: 'user-1',
    counters: {
      tickets: ticketCount,
      asset: { tickets: ticketCount }
    },
    impressions: {},
    cursor: `cursor-${ticketCount}`
  };
}
