import {
  GlobalIdentityMapper
} from './global-identity.mapper';

describe('GlobalIdentityMapper', () => {
  it('keeps the underlying active link while an unlink is pending', () => {
    const status = GlobalIdentityMapper.toStatusDto({
      state: 'UNLINK',
      linked: true,
      consentVersion: 'global-dedup-consent-v1',
      keyVersion: 3,
      suite: 'P256-SHA256',
      activeFromPeriod: '2026-07',
      inactiveFromPeriod: '2026-08',
      verifiedAt: '2026-07-29T04:00:00Z',
      rotationRequired: false,
      syncAvailable: true,
      updatedAt: '2026-07-29T04:01:00Z'
    });

    expect(status.state).toBe('UNLINK');
    expect(status.linked).toBe(true);
    expect(status.keyVersion).toBe(3);
  });

  it('fails closed for malformed server state', () => {
    const status = GlobalIdentityMapper.toStatusDto({
      state: 'UNKNOWN' as never,
      linked: true,
      keyVersion: -1,
      verifiedAt: 'not-a-date'
    });

    expect(status.state).toBe('UNAVAILABLE');
    expect(status.linked).toBe(false);
    expect(status.keyVersion).toBeNull();
    expect(status.verifiedAt).toBeNull();
  });

  it('returns the protocol defaults for the browser-only fallback', () => {
    expect(GlobalIdentityMapper.unavailableStatus()).toEqual({
      state: 'UNAVAILABLE',
      linked: false,
      consentVersion: 'global-dedup-consent-v1',
      keyVersion: null,
      suite: 'P256-SHA256',
      activeFromPeriod: null,
      inactiveFromPeriod: null,
      verifiedAt: null,
      rotationRequired: null,
      syncAvailable: false,
      updatedAt: null
    });
  });
});
