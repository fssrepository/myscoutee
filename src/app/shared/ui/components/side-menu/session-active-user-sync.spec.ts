import {
  signal
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AppSession } from '../../../core/base/services/accounts/session.service';
import { installSessionActiveUserSync } from './session-active-user-sync';

describe('installSessionActiveUserSync', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not replace a hydrated backend profile id with the Firebase uid', () => {
    const session = signal<AppSession | null>(firebaseSession('firebase-uid'));
    const activeUserId = signal('');

    TestBed.runInInjectionContext(() => {
      installSessionActiveUserSync(session, activeUserId.asReadonly(), userId => activeUserId.set(userId));
    });
    TestBed.tick();
    expect(activeUserId()).toBe('firebase-uid');

    activeUserId.set('backend-profile-id');
    TestBed.tick();

    expect(activeUserId()).toBe('backend-profile-id');

    session.set(firebaseSession('firebase-uid'));
    TestBed.tick();

    expect(activeUserId()).toBe('backend-profile-id');
  });

  it('resynchronizes when the authenticated session changes or ends', () => {
    const session = signal<AppSession | null>(firebaseSession('first-firebase-uid'));
    const activeUserId = signal('');

    TestBed.runInInjectionContext(() => {
      installSessionActiveUserSync(session, activeUserId.asReadonly(), userId => activeUserId.set(userId));
    });
    TestBed.tick();
    activeUserId.set('first-backend-profile-id');

    session.set(firebaseSession('second-firebase-uid'));
    TestBed.tick();
    expect(activeUserId()).toBe('second-firebase-uid');

    session.set(null);
    TestBed.tick();
    expect(activeUserId()).toBe('');
  });

  it('synchronizes an operator account using the common canonical identity', () => {
    const session = signal<AppSession | null>({
      kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: 'operator-session', profile: { id: 'persisted-operator-id', name: 'Operator', email: 'operator@example.test', initials: 'O' },
    });
    const activeUserId = signal('persisted-operator-id');

    TestBed.runInInjectionContext(() => {
      installSessionActiveUserSync(
        session,
        activeUserId.asReadonly(),
        userId => activeUserId.set(userId)
      );
    });
    TestBed.tick();
    expect(activeUserId()).toBe('persisted-operator-id');

    session.set(null);
    TestBed.tick();
    expect(activeUserId()).toBe('');
  });
});

function firebaseSession(id: string): AppSession {
  return {
    kind: 'authenticated', accessToken: 'app-token', expiresAt: '2099-07-29T12:00:00Z', sessionId: `session-${id}`,
    profile: {
      id,
      name: 'Firebase User',
      email: 'firebase@example.com',
      initials: 'FU'
    }
  };
}
