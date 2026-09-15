import { resolveRuntimeAuthMode } from './firebase-login-mode';

describe('Firebase login mode', () => {
  it('uses demo selection until the deployment Firebase runtime is active', () => {
    expect(resolveRuntimeAuthMode(true, false)).toBe('selector');
    expect(resolveRuntimeAuthMode(true, true)).toBe('firebase');
    expect(resolveRuntimeAuthMode(false, true)).toBe('selector');
  });
});
