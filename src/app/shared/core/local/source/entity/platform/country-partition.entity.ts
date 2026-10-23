import type { LocationCoordinates } from '../../../../contracts/accounts/user.interface';

/** Offline partition metadata. Country boundary checks belong to the backend. */
export interface CountryPartition {
  partitionKey: string;
  countryCode: string;
  countryName: string;
  city: string;
  locationCoordinates: LocationCoordinates;
}
