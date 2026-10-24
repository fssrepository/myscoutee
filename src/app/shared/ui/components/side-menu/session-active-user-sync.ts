import {
  effect,
  type Signal,
  untracked
} from '@angular/core';

import type { AppSession } from '../../../core/base/services/accounts/session.service';

export function installSessionActiveUserSync(
  session: Signal<AppSession | null>,
  activeUserId: Signal<string>,
  setActiveUserId: (userId: string) => void
): void {
  let previousSessionKey: string | null = null;
  effect(() => {
    const currentSession = session();
    const sessionUserId = currentSession?.kind === 'authenticated'
      ? currentSession.profile.id.trim()
      : currentSession?.kind === 'demo'
        ? currentSession.userId.trim()
        : '';
    const sessionKey = currentSession
        ? `${currentSession.kind}:${sessionUserId}`
        : 'none';
    if (previousSessionKey === sessionKey) {
      return;
    }
    previousSessionKey = sessionKey;

    const currentActiveUserId = untracked(activeUserId).trim();
    if (currentActiveUserId === sessionUserId) {
      return;
    }
    setActiveUserId(sessionUserId);
  });
}
