import { LocalCountryPartitionsRepository } from '../../source/repositories/country-partitions.repository';
import { SeedUserBuilder } from './user-seed.builder';

describe('Pre-registered demo location seed', () => {
  const partitions = new LocalCountryPartitionsRepository();

  it('seeds every generated profile inside a supported partition', () => {
    const users = SeedUserBuilder.buildExpandedDemoUsers(50);
    expect(users).toHaveLength(50);
    for (const user of users) {
      expect(partitions.resolvePartitionKeyByCoordinates(user.locationCoordinates)).toBe('country:hu');
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
