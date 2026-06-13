export interface CountryPartitionBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface CountryPartition {
  partitionKey: string;
  countryCode: string;
  countryName: string;
  bounds: CountryPartitionBounds;
}
