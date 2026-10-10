import { TestBed } from '@angular/core/testing';
import type { UserDto } from '../../../../core/contracts/user.interface';
import { UserProfileStore } from './user-profile.store';
import { AppRuntimeStore } from '../app/app-runtime.store';

describe('Member location availability', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('uses loaded and polled server coordinates without restarting the avatar loader', () => {
    const profile = TestBed.inject(UserProfileStore);
    const runtime = TestBed.inject(AppRuntimeStore);
    profile.setActiveUserProfile({ id: 'member', profileStatus: 'public' } as UserDto);
    runtime.setStatus('user-by-id', 'success');
    expect(profile.activeUserLocationMissing()).toBe(true);
    profile.applyUserRealtimeLocation('member', { latitude: 0, longitude: 0 });
    expect(profile.activeUserLocationMissing()).toBe(false);
    expect(runtime.getLoadingState('user-by-id').status).toBe('success');
    profile.applyUserRealtimeLocation('member', undefined);
    expect(profile.activeUserLocationMissing()).toBe(false);
    profile.applyUserRealtimeLocation('member', null);
    expect(profile.activeUserLocationMissing()).toBe(true);
    expect(runtime.getLoadingState('user-by-id').status).toBe('success');
  });

  it('ignores a location poll started before a profile load saved newer coordinates', () => {
    const profile = TestBed.inject(UserProfileStore);
    profile.setActiveUserProfile({ id: 'member', profileStatus: 'public' } as UserDto);
    const stalePoll = profile.captureUserLocationSyncToken('member');

    profile.setUserProfile({
      id: 'member', profileStatus: 'public',
      locationCoordinates: { latitude: 47.4979, longitude: 19.0402 }
    } as UserDto);
    profile.applyUserRealtimeLocation('member', null, stalePoll);
    expect(profile.activeUserLocationMissing()).toBe(false);

    const currentPoll = profile.captureUserLocationSyncToken('member');
    profile.applyUserRealtimeLocation('member', null, currentPoll);
    expect(profile.activeUserLocationMissing()).toBe(true);
  });

  it('does not apply member location restrictions to the admin or operator workspace', () => {
    const profile = TestBed.inject(UserProfileStore);
    profile.setActiveUserProfile({ id: 'admin', admin: true } as UserDto);
    expect(profile.activeUserLocationMissing()).toBe(false);
    profile.setActiveUserProfile({ id: 'operator', operator: true } as UserDto);
    expect(profile.activeUserLocationMissing()).toBe(false);
  });
});
