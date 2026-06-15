import { PROFILE_EXPERIENCES_TABLE_NAME } from '../entity/profile.entity';
import { Injectable, inject } from '@angular/core';

import type { ExperienceEntry } from '../../../contracts/profile.interface';
import { LocalMemoryDb } from '../../../common/app.db';

import { LocalProfileExperiencesMapper } from '../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalProfileExperiencesRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  queryUserExperienceRecords(userId: string): ExperienceEntry[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[PROFILE_EXPERIENCES_TABLE_NAME];
    return LocalProfileExperiencesMapper.cloneEntries(table.byUserId[normalizedUserId] ?? []);
  }

  replaceUserExperienceRecords(userId: string, entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const entryRecords = LocalProfileExperiencesMapper.cloneEntries(entries);
    this.memoryDb.write(state => {
      const table = state[PROFILE_EXPERIENCES_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(table.byUserId, normalizedUserId);
      return {
        ...state,
        [PROFILE_EXPERIENCES_TABLE_NAME]: {
          byUserId: {
            ...table.byUserId,
            [normalizedUserId]: LocalProfileExperiencesMapper.cloneEntries(entryRecords)
          },
          userIds: exists
            ? [...table.userIds]
            : [...table.userIds, normalizedUserId]
        }
      };
    });

    return LocalProfileExperiencesMapper.cloneEntries(entryRecords);
  }
}
