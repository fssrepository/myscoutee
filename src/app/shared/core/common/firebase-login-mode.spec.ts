import { resolveFirebaseLoginEnabled } from './firebase-login-mode';

describe('Firebase login mode', () => {
  it('allows the explicit QA route only in an opted-in non-production build', () => {
    expect(resolveFirebaseLoginEnabled(false, false, true, '?qaAuth=firebase')).toBe(true);
    expect(resolveFirebaseLoginEnabled(false, false, true, '?qaAuth=other')).toBe(false);
  });

  it('ignores the QA route in production and in builds without the opt-in', () => {
    expect(resolveFirebaseLoginEnabled(false, true, true, '?qaAuth=firebase')).toBe(false);
    expect(resolveFirebaseLoginEnabled(false, false, false, '?qaAuth=firebase')).toBe(false);
  });

  it('keeps an explicitly configured Firebase deployment enabled', () => {
    expect(resolveFirebaseLoginEnabled(true, true, false, '')).toBe(true);
  });
});
