import { LocalCountryPartitionsRepository } from '../../../source/repositories/platform/country-partitions.repository';
import { AdminProfileSeedBuilder } from '../admin/admin-profile-seed.builder';
import { SeedOperatorRegistryBuilder } from '../operator/operator-registry-seed.builder';
import { SeedUserBuilder } from './user-seed.builder';

describe('Pre-registered demo location seed', () => {
  const partitions = new LocalCountryPartitionsRepository();

  it('seeds supported coordinates for every demo profile, including admin and operator', () => {
    const users = SeedUserBuilder.buildExpandedDemoUsers(50);
    expect(users).toHaveLength(50);
    users.push(AdminProfileSeedBuilder.buildDemoAdminUser({ id: 'admin-demo-ava', name: 'Ava', initials: 'AV' }),
      AdminProfileSeedBuilder.buildDemoAdminUser({ id: 'admin-demo-noel', name: 'Noel', initials: 'NS' }),
      SeedOperatorRegistryBuilder.buildDemoOperatorUser());
    expect(new Set(users.map(user => user.partitionKey)))
      .toEqual(new Set(['country:hu', 'country:de', 'country:es', 'country:gb']));
    for (const user of users) {
      expect(user.locationCoordinates, user.id).toBeDefined();
      expect(partitions.queryPartitionByCountryCode(user.partitionKey!.slice(-2))?.partitionKey, user.id).toBe(user.partitionKey);
      for (const coordinate of Object.values(user.locationCoordinates!)) {
        expect(coordinate, user.id).toBe(Number(coordinate.toFixed(6)));
      }
    }
  });

  it('keeps every account location and partition unchanged when the seed is rebuilt', () => {
    const locations = () => SeedUserBuilder.buildExpandedDemoUsers(50).map(user => ({
      id: user.id, city: user.city, locationCoordinates: user.locationCoordinates, partitionKey: user.partitionKey
    }));
    expect(locations()).toEqual(locations());
  });

  it('preserves explicitly supplied fixture coordinates', () => {
    const [user] = SeedUserBuilder.buildExpandedDemoUsers(1);
    const unsupported = { latitude: 30.2672, longitude: -97.7431 };
    const [control] = SeedUserBuilder.buildExpandedDemoUsers(1, [{ ...user, locationCoordinates: unsupported }]);
    expect(control.locationCoordinates).toEqual(unsupported);
  });
});
