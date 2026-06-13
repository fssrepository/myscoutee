import { PROFILE_EXPERIENCES_TABLE_NAME } from '../../source/entity/profile.entity';
import { Injectable, inject } from '@angular/core';

import type { ExperienceEntry } from '../../../contracts/profile.interface';
import { LocalMemoryDb } from '../../common/db';

import { SeedProfileExperienceBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedProfileExperiencesRepository {
  private readonly memoryDb = inject(LocalMemoryDb);
  private initialized = false;

  seedDefaults(): void {
    if (this.initialized) {
      return;
    }

    const seededByUserId = SeedProfileExperienceBuilder.buildSeededExperiencesByUserId();
    const table = this.memoryDb.read()[PROFILE_EXPERIENCES_TABLE_NAME];
    const nextByUserId = { ...table.byUserId };
    const nextUserIds = [...table.userIds];
    let changed = false;

    for (const [userId, entries] of Object.entries(seededByUserId)) {
      const normalizedUserId = userId.trim();
      if (!normalizedUserId || Object.prototype.hasOwnProperty.call(nextByUserId, normalizedUserId)) {
        continue;
      }
      nextByUserId[normalizedUserId] = this.cloneEntries(entries);
      nextUserIds.push(normalizedUserId);
      changed = true;
    }

    if (changed) {
      this.memoryDb.write(state => ({
        ...state,
        [PROFILE_EXPERIENCES_TABLE_NAME]: {
          byUserId: nextByUserId,
          userIds: [...new Set(nextUserIds)]
        }
      }));
    }

    this.initialized = true;
  }

  private cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }
}
