import { shouldApplyUserRealtimeDomainSnapshot } from './user-realtime-popup-policy';

describe('user realtime popup ownership', () => {
  it('defers side-menu domain counters while a foreground popup owns polling', () => {
    expect(shouldApplyUserRealtimeDomainSnapshot(true)).toBe(false);
  });

  it('restores side-menu domain snapshots after the foreground popup closes', () => {
    expect(shouldApplyUserRealtimeDomainSnapshot(false)).toBe(true);
  });
});
