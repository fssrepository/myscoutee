import { TestBed } from '@angular/core/testing';
import type { UserDto } from '../../../core/contracts/user.interface';
import { UserProfileStore } from './user-profile.store';
import { AppRuntimeStore } from './app-runtime.store';

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

  it('does not apply member location restrictions to the admin or operator workspace', () => {
    const profile = TestBed.inject(UserProfileStore);
    profile.setActiveUserProfile({ id: 'admin', admin: true } as UserDto);
    expect(profile.activeUserLocationMissing()).toBe(false);
    profile.setActiveUserProfile({ id: 'operator', operator: true } as UserDto);
    expect(profile.activeUserLocationMissing()).toBe(false);
  });
});
