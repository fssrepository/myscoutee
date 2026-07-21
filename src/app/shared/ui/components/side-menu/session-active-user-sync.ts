import {
  effect,
  type Signal,
  untracked
} from '@angular/core';

import type { AppSession } from '../../../core/base/services/session.service';

export function installSessionActiveUserSync(
  session: Signal<AppSession | null>,
  activeUserId: Signal<string>,
  setActiveUserId: (userId: string) => void
): void {
  let previousSessionKey: string | null = null;
  effect(() => {
    const currentSession = session();
    const sessionUserId = currentSession?.kind === 'firebase'
      ? currentSession.profile.id.trim()
      : currentSession?.userId.trim() ?? '';
    const sessionKey = currentSession ? `${currentSession.kind}:${sessionUserId}` : 'none';
    if (previousSessionKey === sessionKey) {
      return;
    }
    previousSessionKey = sessionKey;

    // The Firebase UID bootstraps profile loading. Do not subscribe to activeUserId here:
    // /auth/me replaces it with the canonical backend profile ID for authorization.
    const currentActiveUserId = untracked(activeUserId).trim();
    if (currentActiveUserId === sessionUserId) {
      return;
    }
    setActiveUserId(sessionUserId);
  });
}
