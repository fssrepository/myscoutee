import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';

import { OfflineCacheService } from '../../base/services/offline-cache.service';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { SessionService, type AppSession } from '../../base/services/session.service';
import { UserDto, type UserByIdQueryResponse } from '../../contracts/user.interface';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
import { HttpUsersService } from './users.service';

describe('HttpUsersService demo authority boundary', () => {
  const get = vi.fn();
  const readUser = vi.fn();
  const writeUser = vi.fn();
  const withRequestTimeout = vi.fn();
  let currentSession: AppSession | null;

  beforeEach(() => {
    currentSession = { kind: 'demo', userId: 'demo-user' };
    get.mockReset();
    readUser.mockReset();
    writeUser.mockReset();
    withRequestTimeout
      .mockReset()
      .mockImplementation((_route: string, task: Promise<unknown>) => task);
    TestBed.configureTestingModule({
      providers: [
        HttpUsersService,
        { provide: HttpClient, useValue: { get } },
        { provide: OfflineCacheService, useValue: { readUser, writeUser } },
        { provide: RouteDelayService, useValue: { withRequestTimeout } },
        {
          provide: SessionService,
          useValue: { currentSession: () => currentSession }
        },
        {
          provide: UserProfileStore,
          useValue: { activeUserProfile: () => null }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('fails closed instead of authorizing a demo user from browser cache when Java is unavailable', async () => {
    get.mockReturnValue(throwError(() => new Error('network unavailable')));
    readUser.mockReturnValue(cachedUserResponse());

    await expect(TestBed.inject(HttpUsersService).queryUserById('demo-user'))
      .rejects.toThrow('network unavailable');

    expect(readUser).not.toHaveBeenCalled();
  });

  it('does not expose a direct browser-cache peek during a backend demo session', () => {
    readUser.mockReturnValue(cachedUserResponse());

    expect(TestBed.inject(HttpUsersService).peekCachedUserById('demo-user')).toBeNull();
    expect(readUser).not.toHaveBeenCalled();
  });

  it('retains read-through offline resilience for a Firebase user without making it a demo authority', async () => {
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'firebase-user',
        name: 'Firebase User',
        email: 'firebase@example.com',
        initials: 'FU'
      }
    };
    const cached = cachedUserResponse('firebase-user');
    get.mockReturnValue(throwError(() => new Error('network unavailable')));
    readUser.mockReturnValue(cached);

    await expect(TestBed.inject(HttpUsersService).queryUserById('firebase-user'))
      .resolves.toEqual(cached);
    expect(readUser).toHaveBeenCalledWith('firebase-user');
  });

  it('fails closed for an operator bootstrap profile instead of using browser cache', async () => {
    currentSession = {
      kind: 'operator-bootstrap',
      email: 'operator@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    };
    get.mockReturnValue(throwError(() => new Error('network unavailable')));
    readUser.mockReturnValue(cachedUserResponse('stale-user'));

    await expect(TestBed.inject(HttpUsersService).queryUserById())
      .rejects.toThrow('network unavailable');
    expect(readUser).not.toHaveBeenCalled();
  });
});

function cachedUserResponse(userId = 'demo-user'): UserByIdQueryResponse {
  const user = new UserDto();
  user.id = userId;
  user.name = 'Cached user';
  user.initials = 'CU';
  return { user };
}
