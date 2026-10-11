import { Injectable, inject } from '@angular/core';

import { SeedHelpCenterRepository } from '../../repositories/help/help-center-seed.repository';
import { SeedIdeaPostsRepository } from '../../repositories/content/idea-posts-seed.repository';

@Injectable({
  providedIn: 'root'
})
export class SeedStaticContentService {
  private readonly helpCenter = inject(SeedHelpCenterRepository);
  private readonly ideaPosts = inject(SeedIdeaPostsRepository);

  async ensureReady(): Promise<void> {
    await this.helpCenter.seedDefaults();
    await this.ideaPosts.seedDefaults();
  }
}
