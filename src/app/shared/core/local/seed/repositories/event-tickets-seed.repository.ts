import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import { EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import { EVENT_TICKETS_TABLE_NAME } from '../../source/entity/event-ticket.entity';
import { SeedEventTicketsBuilder } from '../builders';
import type { ActivityEventRecord } from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class SeedEventTicketsRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(): boolean {
    const state = this.memoryDb.read();
    const currentTable = state[EVENT_TICKETS_TABLE_NAME];
    if (this.initialized || currentTable.ids.length > 0) {
      this.initialized = true;
      return false;
    }
    const events = state[EVENTS_TABLE_NAME].ids
      .map(id => state[EVENTS_TABLE_NAME].byId[id])
      .filter((record): record is ActivityEventRecord => Boolean(record));
    const seeded = SeedEventTicketsBuilder.buildRecordCollection(events);
    this.memoryDb.write(currentState => ({
      ...currentState,
      [EVENT_TICKETS_TABLE_NAME]: seeded
    }));
    this.initialized = true;
    return seeded.ids.length > 0;
  }
}
