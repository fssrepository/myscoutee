import { Injectable, inject } from '@angular/core';

import { DEMO_RATES_BY_USER } from '../../../demo-data';
import { AppMemoryDb } from '../../base/db';
import { DemoRatesRepositoryBuilder } from '../builders';
import { RATES_TABLE_NAME, type DemoRateRecord } from '../models/rates.model';

@Injectable({
  providedIn: 'root'
})
export class DemoRatesRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  constructor() {
    this.init();
  }

  init(): void {
    const state = this.memoryDb.read();
    if (state[RATES_TABLE_NAME].ids.length > 0) {
      return;
    }
    const records = DemoRatesRepositoryBuilder.buildRecordCollection(DEMO_RATES_BY_USER);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [RATES_TABLE_NAME]: records
    }));
  }

  queryRateItemsByUser(userId: string): DemoRateRecord[] {
    return this.queryUserRecords(userId);
  }

  private queryUserRecords(userId: string): DemoRateRecord[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[RATES_TABLE_NAME];
    return table.ids
      .map(id => table.byId[id])
      .filter((record): record is DemoRateRecord => Boolean(record))
      .filter(record => record.ownerUserId === normalizedUserId)
      .map(record => DemoRatesRepositoryBuilder.cloneRecord(record));
  }
}
