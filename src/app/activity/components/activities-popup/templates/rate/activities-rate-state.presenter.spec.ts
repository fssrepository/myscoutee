import type { ActivityRateDTO } from '../../../../../shared/core/contracts/activity.interface';
import { pendingActivitiesRateDirectionAfterRating } from './activities-rate-state.presenter';

describe('pendingActivitiesRateDirectionAfterRating', () => {
  const rate = (direction: ActivityRateDTO['direction'], met = false): ActivityRateDTO => ({
    id: 'rate-1',
    userId: 'user-2',
    mode: 'individual',
    direction,
    scoreGiven: direction === 'met' ? 0 : 7,
    scoreReceived: direction === 'received' ? 8 : 0,
    eventName: 'Mingle',
    happenedAt: '2026-09-21T10:00:00Z',
    met
  });

  it('moves met evidence through given and received before returning to met', () => {
    expect(pendingActivitiesRateDirectionAfterRating(rate('met', true))).toBe('given');
    expect(pendingActivitiesRateDirectionAfterRating(rate('received', true))).toBe('met');
  });

  it('keeps the normal received to mutual transition without met evidence', () => {
    expect(pendingActivitiesRateDirectionAfterRating(rate('received'))).toBe('mutual');
  });
});
