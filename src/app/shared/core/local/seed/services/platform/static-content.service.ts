import { Injectable, inject } from '@angular/core';

import { SeedHelpCenterRepository } from '../../repositories/help/help-center-seed.repository';
import { SeedIdeaPostsRepository } from '../../repositories/content/idea-posts-seed.repository';
import { I18nService } from '../../../../base/services/localization/i18n.service';

@Injectable({
  providedIn: 'root'
})
export class SeedStaticContentService {
  private readonly helpCenter = inject(SeedHelpCenterRepository);
  private readonly ideaPosts = inject(SeedIdeaPostsRepository);
  private readonly i18n = inject(I18nService);

  async ensureReady(): Promise<void> {
    await this.helpCenter.seedDefaults(this.i18n.currentLanguage());
    await this.ideaPosts.seedDefaults();
  }
}
