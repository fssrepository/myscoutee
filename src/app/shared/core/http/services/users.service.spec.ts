import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

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
  const setFirebaseAvatarPreview = vi.fn();
  const setFirebaseAvatarPreviewData = vi.fn();
  const withRequestTimeout = vi.fn();
  let currentSession: AppSession | null;

  beforeEach(() => {
    currentSession = { kind: 'demo', userId: 'demo-user' };
    get.mockReset();
    readUser.mockReset();
    writeUser.mockReset();
    setFirebaseAvatarPreview.mockReset();
    setFirebaseAvatarPreviewData.mockReset();
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
          useValue: { currentSession: () => currentSession, setFirebaseAvatarPreview, setFirebaseAvatarPreviewData }
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

  it('restores a warmed backend demo profile from cache only while offline', async () => {
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const cached = cachedUserResponse();
    get.mockReturnValue(throwError(() => new Error('network unavailable')));
    readUser.mockReturnValue(cached);

    try {
      expect(TestBed.inject(HttpUsersService).peekCachedUserById('demo-user'))
        .toEqual(cached.user);
      await expect(TestBed.inject(HttpUsersService).queryUserById('demo-user'))
        .resolves.toEqual(cached);
    } finally {
      offline.mockRestore();
    }
  });

  it('retains read-through offline resilience for a Firebase user without making it a demo authority', async () => {
    currentSession = {
      kind: 'firebase',
      sessionId: 'test-session',
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

  it('binds the server profile photo to the requesting Firebase session despite different user IDs', async () => {
    currentSession = { kind: 'firebase', sessionId: 'current-session', profile: {
      id: 'firebase-uid', name: 'User', email: 'user@example.test', initials: 'U'
    } };
    const user = { ...cachedUserResponse('server-profile-id').user!, images: ['/api/media/private?key=private/images/owner/profile/upload/large.webp'] };
    get.mockReturnValue(of(user));
    await TestBed.inject(HttpUsersService).queryUserById();
    expect(setFirebaseAvatarPreview).toHaveBeenCalledExactlyOnceWith('current-session', user.images[0]);
  });

  function previewSession(imageUrl: string, dataUrl?: string) {
    currentSession = { kind: 'firebase', sessionId: 'current-session',
      profile: { id: 'firebase-uid', name: 'User', email: 'user@example.test', initials: 'U' },
      avatarImageUrl: imageUrl, avatarImageDataUrl: dataUrl };
    return { ...cachedUserResponse('profile-id').user!, images: [imageUrl] };
  }

  it('stores only the small authenticated image once, without delaying the profile response', async () => {
    const url = '/api/media/private?key=private/images/owner/profile/upload/large.webp';
    const user = previewSession(url);
    get.mockReturnValueOnce(of(user)).mockReturnValueOnce(of(new Blob(['RIFF'], { type: 'image/webp' })));
    expect((await TestBed.inject(HttpUsersService).queryUserById()).user).toBe(user);
    await vi.waitFor(() => expect(setFirebaseAvatarPreviewData).toHaveBeenCalledExactlyOnceWith(
      'current-session', url, 'data:image/webp;base64,UklGRg=='
    ));
    expect(get.mock.calls[1][0]).toContain('small.webp');
    expect(get.mock.calls[1][1]).toEqual({ responseType: 'blob' });
  });

  it('does not download image bytes again when the matching session already has them', async () => {
    const user = previewSession('/api/media/private?key=private/images/owner/profile/upload/large.webp', 'data:image/webp;base64,UklGRg==');
    get.mockReturnValue(of(user));
    await TestBed.inject(HttpUsersService).queryUserById();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not send a preview request to an external origin', async () => {
    const user = previewSession('https://other.example/api/media/private?key=private/images/owner/profile/upload/large.webp');
    get.mockReturnValue(of(user));
    await TestBed.inject(HttpUsersService).queryUserById();
    expect(get).toHaveBeenCalledTimes(1);
    expect(setFirebaseAvatarPreviewData).not.toHaveBeenCalled();
  });

  it.each([new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob(['x'.repeat(65537)], { type: 'image/webp' })])(
    'keeps the authenticated profile but rejects an invalid preview blob', async blob => {
      const user = previewSession('/api/media/private?key=private/images/owner/profile/upload/large.webp');
      get.mockReturnValueOnce(of(user)).mockReturnValueOnce(of(blob));
      expect((await TestBed.inject(HttpUsersService).queryUserById()).user).toBe(user);
      expect(setFirebaseAvatarPreviewData).not.toHaveBeenCalled();
    });
});

function cachedUserResponse(userId = 'demo-user'): UserByIdQueryResponse {
  const user = new UserDto();
  user.id = userId;
  user.name = 'Cached user';
  user.initials = 'CU';
  return { user };
}
