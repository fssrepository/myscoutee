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
      : currentSession?.kind === 'demo'
        ? currentSession.userId.trim()
        : '';
    const sessionKey = currentSession?.kind === 'operator-bootstrap'
      ? `operator-bootstrap:${currentSession.email.trim()}`
      : currentSession
        ? `${currentSession.kind}:${sessionUserId}`
        : 'none';
    if (previousSessionKey === sessionKey) {
      return;
    }
    previousSessionKey = sessionKey;

    // The bootstrap token has no browser-side user id. Keep the canonical /auth/me
    // profile id while the side menu hydrates that server-owned Operator record.
    if (currentSession?.kind === 'operator-bootstrap') {
      return;
    }
    // The Firebase UID bootstraps profile loading. Do not subscribe to activeUserId
    // here: /auth/me replaces it with the canonical backend profile ID.
    const currentActiveUserId = untracked(activeUserId).trim();
    if (currentActiveUserId === sessionUserId) {
      return;
    }
    setActiveUserId(sessionUserId);
  });
}
