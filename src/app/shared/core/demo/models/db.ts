import { Injectable, signal } from '@angular/core';

import {
  USERS_TABLE_NAME,
  USER_RATES_TABLE_NAME,
  type DemoUsersMemorySchema
} from './users.model';

@Injectable({
  providedIn: 'root'
})
export class DemoUsersMemoryDb {
  private readonly _tables = signal<DemoUsersMemorySchema>({
    [USERS_TABLE_NAME]: {
      byId: {},
      ids: []
    },
    [USER_RATES_TABLE_NAME]: {
      byId: {},
      ids: []
    }
  });

  readonly tables = this._tables.asReadonly();

  read(): DemoUsersMemorySchema {
    return this._tables();
  }

  write(updater: (current: DemoUsersMemorySchema) => DemoUsersMemorySchema): void {
    this._tables.set(updater(this._tables()));
  }
}
