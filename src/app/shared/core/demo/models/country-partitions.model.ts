export interface DemoCountryPartitionBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface DemoCountryPartition {
  partitionKey: string;
  countryCode: string;
  countryName: string;
  bounds: DemoCountryPartitionBounds;
}
