import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from '../../../core/base/services/notifications.service';
import { ActivityStore } from './activity.store';
import { NotificationCenterStore } from './notification-center.store';
import { UserProfileStore } from './user-profile.store';

describe('NotificationCenterStore realtime unread synchronization', () => {
  const setUserCounterOverride = vi.fn();
  const patchUserActivityCounters = vi.fn();
  const patchUserNotificationPreferences = vi.fn();

  beforeEach(() => {
    setUserCounterOverride.mockReset();
    patchUserActivityCounters.mockReset();
    patchUserNotificationPreferences.mockReset();

    TestBed.configureTestingModule({
      providers: [
        NotificationCenterStore,
        {
          provide: NotificationsService,
          useValue: {
            pollIntervalMs: vi.fn().mockReturnValue(30_000)
          }
        },
        {
          provide: ActivityStore,
          useValue: { setUserCounterOverride }
        },
        {
          provide: UserProfileStore,
          useValue: {
            patchUserActivityCounters,
            patchUserNotificationPreferences
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('rejects a realtime response captured before a newer unread mutation', () => {
    const store = TestBed.inject(NotificationCenterStore);
    store.initialize('user-1', 4);
    const staleToken = store.captureUnreadSyncToken();

    store.syncUnreadCount(3);

    expect(store.applyRealtimeUnreadCount(staleToken, 9)).toBe(false);
    expect(store.unreadCount()).toBe(3);
    expect(setUserCounterOverride).toHaveBeenLastCalledWith(
      'user-1',
      'notifications',
      3
    );
  });

  it('rejects a stale token after reset and reinitialize of the same user', () => {
    const store = TestBed.inject(NotificationCenterStore);
    store.initialize('user-1', 4);
    const staleToken = store.captureUnreadSyncToken();

    store.reset();
    store.initialize('user-1', 4);
    const currentToken = store.captureUnreadSyncToken();

    expect(currentToken.userId).toBe(staleToken.userId);
    expect(currentToken.revision).toBe(staleToken.revision);
    expect(currentToken.generation).not.toBe(staleToken.generation);
    expect(store.applyRealtimeUnreadCount(staleToken, 9)).toBe(false);
    expect(store.unreadCount()).toBe(4);
  });

  it('accepts the current token and announces only an increased unread count', () => {
    const store = TestBed.inject(NotificationCenterStore);
    store.initialize('user-1', 4);
    const currentToken = store.captureUnreadSyncToken();

    expect(store.applyRealtimeUnreadCount(currentToken, 5)).toBe(true);
    expect(store.unreadCount()).toBe(5);
    expect(store.attentionVisible()).toBe(true);
  });

  it('shows initial unread attention once without undoing a dismissal on same-user sync', () => {
    const store = TestBed.inject(NotificationCenterStore);

    store.initialize('user-1', 4);
    expect(store.attentionVisible()).toBe(true);

    store.dismissAttention();
    store.initialize('user-1', 4);
    expect(store.attentionVisible()).toBe(false);

    store.syncUnreadCount(5, { announce: true });
    expect(store.attentionVisible()).toBe(true);
  });

  it('keeps initial unread attention hidden when alerts are muted', () => {
    const store = TestBed.inject(NotificationCenterStore);

    store.initialize('user-1', 4, true);

    expect(store.attentionVisible()).toBe(false);
  });

  it('opens and closes the already-loaded popup shell without a server request', () => {
    const store = TestBed.inject(NotificationCenterStore);
    const notificationsService = TestBed.inject(NotificationsService);
    store.initialize('user-1', 4);

    store.open();

    expect(store.isOpen()).toBe(true);
    expect(store.attentionVisible()).toBe(false);
    expect(notificationsService.pollIntervalMs).not.toHaveBeenCalled();

    store.close();

    expect(store.isOpen()).toBe(false);
  });
});
