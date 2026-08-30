import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  UserMenuCountersDto,
  UserRealtimeLongPollResponseDto
} from '../../../core/contracts/user.interface';
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

  it('rejects a response captured before a newer operation-owned counter delta', () => {
    const staleToken = activityStore.captureUserCounterSyncToken('user-1');
    activityStore.patchUserCounterDeltas('user-1', {
      invitations: -1,
      event: {
        pending: 1,
        invitations: -1
      }
    }, {
      invitations: 1,
      event: {
        all: 1,
        active: 0,
        pending: 0,
        invitations: 1,
        hosting: 0,
        drafts: 0,
        trash: 0
      }
    });

    expect(userProfileStore.applyUserRealtimeCounters('user-1', {
      userId: 'user-1',
      counters: {
        invitations: 1,
        event: { pending: 0, invitations: 1 }
      },
      impressions: {},
      cursor: 'stale-before-counter-delta'
    }, staleToken)).toBe(false);
    expect(activityStore.getUserCounterOverrides('user-1')).toMatchObject({
      invitations: 0,
      event: {
        pending: 1,
        invitations: 0
      }
    });
  });

  it('invalidates an in-flight response when its user counters are cleared', () => {
    activityStore.setUserCounterOverride('user-1', 'tickets', 2);
    const staleToken = activityStore.captureUserCounterSyncToken('user-1');
    activityStore.clearUserCounterOverrides('user-1');

    expect(userProfileStore.applyUserRealtimeCounters('user-1', snapshot(1), staleToken)).toBe(false);
    expect(activityStore.getUserCounterOverride('user-1', 'tickets')).toBeNull();
  });

  it('keeps the active Chats branch and applies only inactive Rates and Events counters', () => {
    activityStore.signalUserChatCounterSnapshot('user-1', 8, {
      all: 8,
      event: 3,
      subEvent: 2,
      group: 1,
      service: 1,
      appSupport: 1
    });
    const token = activityStore.captureUserCounterSyncToken('user-1');

    expect(activityStore.applyInactiveActivitiesCounterSnapshot(token, menuCounters(), 'chats')).toBe(true);
    expect(activityStore.getUserCounterOverrides('user-1')).toMatchObject({
      game: 2,
      chats: 8,
      events: 4,
      chat: { all: 8, group: 1 },
      event: { all: 7, active: 4 }
    });
  });

  it('keeps the active Rates branch and applies only inactive Chats and Events counters', () => {
    activityStore.signalUserRateCounterSnapshot('user-1', 9);
    const token = activityStore.captureUserCounterSyncToken('user-1');

    expect(activityStore.applyInactiveActivitiesCounterSnapshot(token, menuCounters(), 'rates')).toBe(true);
    expect(activityStore.getUserCounterOverrides('user-1')).toMatchObject({
      game: 9,
      chats: 5,
      events: 4,
      chat: { all: 5, group: 2 },
      event: { all: 7, active: 4 }
    });
  });

  it('keeps the active Events branch and applies only inactive Rates and Chats counters', () => {
    activityStore.signalUserEventCounterSnapshot('user-1', {
      all: 12,
      active: 10,
      pending: 0,
      invitations: 1,
      hosting: 1,
      drafts: 0,
      trash: 0
    });
    const token = activityStore.captureUserCounterSyncToken('user-1');

    expect(activityStore.applyInactiveActivitiesCounterSnapshot(token, menuCounters(), 'events')).toBe(true);
    expect(activityStore.getUserCounterOverrides('user-1')).toMatchObject({
      game: 2,
      chats: 5,
      events: 10,
      invitations: 1,
      hosting: 1,
      chat: { all: 5, group: 2 },
      event: { all: 12, active: 10 }
    });
  });
});

function menuCounters(): UserMenuCountersDto {
  return {
    game: 2,
    chats: 5,
    invitations: 2,
    events: 4,
    hosting: 1,
    cars: 0,
    accommodation: 0,
    supplies: 0,
    tickets: 0,
    contacts: 0,
    feedback: 0,
    chat: {
      all: 5,
      event: 1,
      subEvent: 1,
      group: 2,
      service: 1,
      appSupport: 0
    },
    event: {
      all: 7,
      active: 4,
      pending: 0,
      invitations: 2,
      hosting: 1,
      drafts: 0,
      trash: 0
    },
    asset: { cars: 0, accommodation: 0, supplies: 0, tickets: 0 },
    eventFeedback: { ownEvents: 0, pending: 0, feedbacked: 0, removed: 0 },
    adminJobs: 0,
    adminMetrics: 0,
    notifications: 0
  };
}

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
