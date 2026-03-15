import type { RateMenuItem } from '../../../demo-data';

export const RATES_TABLE_NAME = 'rates' as const;

export interface DemoRateRecord extends RateMenuItem {
  ownerUserId: string;
}

export interface DemoRateRecordCollection {
  byId: Record<string, DemoRateRecord>;
  ids: string[];
}

export type DemoRatesMemorySchema = Record<typeof RATES_TABLE_NAME, DemoRateRecordCollection>;
