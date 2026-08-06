import { describe, expect, it } from 'vitest';

import { ActivityStore, type ActivityCounters } from './activity.store';

describe('activity event bucket count signal', () => {
  const baseCounters: Partial<ActivityCounters> = {
    events: 4,
    invitations: 2,
    hosting: 1,
    event: {
      all: 7,
      active: 4,
      pending: 1,
      invitations: 2,
      hosting: 1,
      drafts: 3,
      trash: 0
    }
  };

  it('uses one shared counter signal for My Events and preserves the other buckets', () => {
    const store = new ActivityStore();

    store.signalUserEventBucketCount('user-1', 'my-events', 5, baseCounters);

    expect(store.getUserCounterOverrides('user-1')).toMatchObject({
      hosting: 5,
      event: {
        all: 7,
        active: 4,
        pending: 1,
        invitations: 2,
        hosting: 5,
        drafts: 3,
        trash: 0
      }
    });
  });

  it('publishes every event bucket through the same signal and mirrors menu-backed buckets', () => {
    const store = new ActivityStore();

    store.signalUserEventBucketCount('user-1', 'active-events', 3, baseCounters);
    store.signalUserEventBucketCount('user-1', 'invitations', 6, baseCounters);
    store.signalUserEventBucketCount('user-1', 'pending', 2, baseCounters);
    store.signalUserEventBucketCount('user-1', 'drafts', 4, baseCounters);

    expect(store.getUserCounterOverrides('user-1')).toMatchObject({
      events: 3,
      invitations: 6,
      event: {
        active: 3,
        invitations: 6,
        pending: 2,
        hosting: 1,
        drafts: 4
      }
    });
  });

  it('publishes the Ticket list count through the shared menu and asset signal', () => {
    const store = new ActivityStore();

    store.signalUserTicketBucketCount('user-1', 3, {
      tickets: 1,
      asset: {
        cars: 2,
        accommodation: 4,
        supplies: 6,
        tickets: 1
      }
    });

    expect(store.getUserCounterOverrides('user-1')).toMatchObject({
      tickets: 3,
      asset: {
        cars: 2,
        accommodation: 4,
        supplies: 6,
        tickets: 3
      }
    });
  });
});
