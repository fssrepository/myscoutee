import { describe, expect, it } from 'vitest';
import { UserDto } from '../../shared/core/contracts/user.interface';
import { APP_STATIC_DATA } from '../../shared/app-static-data';
import { SeedUserBuilder } from '../../shared/core/local/seed/builders/user-seed.builder';
import { LocalGameService } from '../../shared/core/local/source/services/game.service';
import { LocalUsersMapper } from '../../shared/core/local/source/mappers/user.mapper';
import { getGameUserFacet, getGameUserInterests, getGameUserValues } from './home-game-filter.shared';

function profile(value: string, id = 'configured-account'): UserDto {
  const user = new UserDto();
  user.id = id;
  user.profileDetails = [{ title: 'Relationships', rows: [
    { labelKey: 'profile.details.children', value, privacy: 'Public', options: [] }
  ] }];
  return user;
}

describe('saved game-filter profile facets', () => {
  it.each([['No', 'no'], ['Yes', 'yes'], ['Prefer not to say', 'prefer not to say']])(
    'uses persisted %s for configured accounts', (stored, expected) => {
      expect(getGameUserFacet(profile(stored)).children).toBe(expected);
    }
  );
  it('uses edited demo profile values and preserves an explicit clear', () => {
    expect(getGameUserFacet(profile('Yes', 'u1')).children).toBe('yes');
    expect(getGameUserFacet(profile('', 'u1')).children).toBe('');
  });
  it('does not infer personal data for an unseeded real profile', () => {
    const user = profile('');
    delete user.profileDetails;
    expect(getGameUserFacet(user).children).toBe('');
    expect(getGameUserFacet(user).sexualOrientation).toBe('');
  });
  it('preserves all 50 seeded local users through the repository mapper', () => {
    const seeded = SeedUserBuilder.buildExpandedDemoUsers(50);
    for (const user of seeded) {
      const facet = getGameUserFacet(LocalUsersMapper.toDto(user));
      const prior = APP_STATIC_DATA.homeUserFacetById[user.id];
      if (prior) expect(facet).toEqual({ ...prior, gender: user.gender });
      else expect(facet).toEqual({ gender: user.gender, interests: [], values: [], smoking: 'never', drinking: 'never',
        workout: 'weekly', pets: 'all pets welcome', familyPlans: 'open to both', children: 'no',
        loveStyle: 'slow-burn connection', communicationStyle: 'direct + warm',
        sexualOrientation: 'straight', religion: 'not religious' });
    }
  });
  it('seed preparation preserves existing and explicitly cleared profile details', () => {
    for (const details of [profile('Yes').profileDetails!, []]) {
      const seed = {...SeedUserBuilder.buildExpandedDemoUsers(1)[0], profileDetails: details};
      expect(SeedUserBuilder.withSeededProfileDetails(seed).profileDetails).toBe(details);
    }
  });
  it('local filtering uses the same saved values after edits and clears', () => {
    const service = Object.create(LocalGameService.prototype) as {
      matchesFilterPreferences(user: UserDto, preferences: {children: string[]}): boolean;
    };
    for (const record of SeedUserBuilder.buildExpandedDemoUsers(50)) {
      const user = LocalUsersMapper.toDto(record);
      expect(service.matchesFilterPreferences(user, {children: [getGameUserFacet(user).children]})).toBe(true);
      expect(service.matchesFilterPreferences(user, {children: ['unmatched']})).toBe(false);
    }
    expect(service.matchesFilterPreferences(profile('Yes', 'u1'), {children: ['no']})).toBe(false);
    expect(service.matchesFilterPreferences(profile('Yes', 'u1'), {children: ['yes']})).toBe(true);
    expect(service.matchesFilterPreferences(profile('', 'u1'), {children: ['no']})).toBe(false);
    expect(service.matchesFilterPreferences(profile('', 'u1'), {children: []})).toBe(true);
  });
  it('reads saved multi-select values and lifestyle details', () => {
    const user = profile('No');
    user.profileDetails![0].rows.push(
      { labelKey: 'profile.details.interest', value: '#Travel, #Sports', privacy: 'Public', options: [] },
      { labelKey: 'profile.details.values', value: 'Family-first, Community-driven', privacy: 'Public', options: [] },
      { labelKey: 'profile.details.smoking', value: 'Occasionally', privacy: 'Public', options: [] }
    );
    expect(getGameUserInterests(user)).toEqual(['#Travel', '#Sports']);
    expect(getGameUserValues(user)).toEqual(['Family-first', 'Community-driven']);
    expect(getGameUserFacet(user).smoking).toBe('occasionally');
  });
});
