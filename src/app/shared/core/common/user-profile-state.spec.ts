import type { UserDto } from '../contracts/accounts/user.interface';
import { UserProfileState } from './user-profile-state';

describe('UserProfileState operator visibility', () => {
  it('keeps an operator out of game and rating visibility', () => {
    const operator = profile('public', { operator: true });

    expect(UserProfileState.isPublicGameProfile(operator)).toBe(false);
    expect(UserProfileState.isInsideNetworkGameProfile(operator)).toBe(false);
    expect(UserProfileState.isActivityRateVisibleProfile(operator)).toBe(false);
  });

  it('preserves ordinary Member and Admin status semantics', () => {
    const member = profile('public');
    const friendsOnlyMember = profile('friends only');
    const admin = profile('public', { admin: true });

    expect(UserProfileState.isPublicGameProfile(member)).toBe(true);
    expect(UserProfileState.isInsideNetworkGameProfile(member)).toBe(true);
    expect(UserProfileState.isInsideNetworkGameProfile(friendsOnlyMember)).toBe(true);
    expect(UserProfileState.isActivityRateVisibleProfile(friendsOnlyMember)).toBe(true);
    expect(UserProfileState.isPublicGameProfile(admin)).toBe(true);
    expect(UserProfileState.isActivityRateVisibleProfile(admin)).toBe(true);
  });

  it('excludes lifecycle-deleted, blocked and inactive profiles even when an older local seed retained a visible profileStatus', () => {
    for (const status of ['D', 'B', 'I'] as const) {
      for (const profileStatus of ['public', 'friends only'] as const) {
        const user = { ...profile(profileStatus), status };
        expect(UserProfileState.isPublicGameProfile(user)).toBe(false);
        expect(UserProfileState.isInsideNetworkGameProfile(user)).toBe(false);
        expect(UserProfileState.isActivityRateVisibleProfile(user)).toBe(false);
      }
    }
  });

  it('preserves hard-hidden status handling for non-operators', () => {
    const blocked = profile('blocked');

    expect(UserProfileState.isPublicGameProfile(blocked)).toBe(false);
    expect(UserProfileState.isInsideNetworkGameProfile(blocked)).toBe(false);
    expect(UserProfileState.isActivityRateVisibleProfile(blocked)).toBe(false);
  });
});

function profile(
  profileStatus: UserDto['profileStatus'],
  overrides: Partial<Pick<UserDto, 'operator' | 'admin'>> = {}
): Pick<UserDto, 'profileStatus' | 'operator' | 'admin'> {
  return {
    profileStatus,
    ...overrides
  };
}
