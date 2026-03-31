import { Injectable, inject } from '@angular/core';

import type { UserExperiencesPersistenceService } from '../../base/interfaces/experience.interface';
import type { ExperienceEntry } from '../../base/models/profile.model';
import { DemoProfileExperiencesRepository } from '../repositories/profile-experiences.repository';

@Injectable({
  providedIn: 'root'
})
export class DemoUserExperiencesService implements UserExperiencesPersistenceService {
  private readonly repository = inject(DemoProfileExperiencesRepository);

  async queryUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    return this.repository.queryUserExperiences(userId);
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    return this.repository.replaceUserExperiences(userId, entries);
  }
}
