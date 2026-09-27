import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { RouteDelayService } from './route-delay.service';
import { SessionService } from './session.service';
import { HttpNotificationsService } from '../../http/services/notifications.service';
import { LocalNotificationsService } from '../../local/source/services/notifications.service';

describe('Notification read mutation result across adapters', () => {
  const notification = { id: 'notice', recipientUserId: 'account', title: 'Group', message: 'Member left',
    createdAtIso: '2026-09-27T00:00:00Z', sourceType: 'community', sourceId: 'group',
    payload: { communityAttention: 'members' } };
  const post = vi.fn();
  const localMarkRead = vi.fn();
  beforeEach(() => {
    post.mockReset(); localMarkRead.mockReset();
    TestBed.configureTestingModule({ providers: [NotificationsService, HttpNotificationsService,
      { provide: HttpClient, useValue: { post } },
      { provide: LocalNotificationsService, useValue: { markRead: localMarkRead } },
      { provide: SessionService, useValue: {} },
      { provide: RouteDelayService, useValue: { withRequestTimeout: (_route: string, task: Promise<unknown>) => task } }
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it.each(['http', 'local'] as const)('preserves the persisted attention delta and zero on retry through %s', async mode => {
    const service = TestBed.inject(NotificationsService);
    vi.spyOn(service as unknown as { resolveRouteMode(): string }, 'resolveRouteMode').mockReturnValue(mode);
    const first = { notification, unreadCount: 2, communityActivityDelta: -1 };
    const retry = { notification, unreadCount: 2, communityActivityDelta: 0 };
    post.mockReturnValueOnce(of(first)).mockReturnValueOnce(of(retry));
    localMarkRead.mockResolvedValueOnce(first).mockResolvedValueOnce(retry);
    expect(await service.markRead('account', 'notice')).toMatchObject(first);
    expect(await service.markRead('account', 'notice')).toMatchObject(retry);
    expect(mode === 'http' ? post : localMarkRead).toHaveBeenCalledTimes(2);
  });
});
