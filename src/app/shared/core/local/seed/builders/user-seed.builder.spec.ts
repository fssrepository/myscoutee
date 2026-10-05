import { LocalCountryPartitionsRepository } from '../../source/repositories/country-partitions.repository';
import { SeedUserBuilder } from './user-seed.builder';

describe('Pre-registered demo location seed', () => {
  const partitions = new LocalCountryPartitionsRepository();

  it('seeds supported coordinates for all but two location-prompt profiles', () => {
    const users = SeedUserBuilder.buildExpandedDemoUsers(50);
    expect(users).toHaveLength(50);
    expect(users.filter(user => !user.locationCoordinates)).toHaveLength(2);
    expect(new Set(users.map(user => partitions.resolvePartitionKeyByCoordinates(user.locationCoordinates))))
      .toEqual(new Set(['country:hu', 'country:de', 'country:es', 'country:gb', null]));
    for (const user of users) {
      if (SeedUserBuilder.LOCATION_PROMPT_USER_IDS.includes(user.id)) {
        expect(user.locationCoordinates).toBeUndefined();
      } else {
        expect(partitions.resolvePartitionKeyByCoordinates(user.locationCoordinates)).not.toBeNull();
      }
    }
  });

  it('does not turn an explicitly unsupported fixture coordinate into an eligible one', () => {
    const [user] = SeedUserBuilder.buildExpandedDemoUsers(1);
    const unsupported = { latitude: 30.2672, longitude: -97.7431 };
    const [control] = SeedUserBuilder.buildExpandedDemoUsers(1, [{ ...user, locationCoordinates: unsupported }]);
    expect(control.locationCoordinates).toEqual(unsupported);
    expect(partitions.resolvePartitionKeyByCoordinates(control.locationCoordinates)).toBeNull();
  });
});
