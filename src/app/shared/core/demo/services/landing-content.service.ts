import { Injectable, inject } from '@angular/core';

import type { LandingContentState } from '../../base/models';
import { DemoHelpCenterService } from './help-center.service';
import { DemoIdeaPostsService } from './idea-posts.service';
import { I18nService } from '../../../i18n';

@Injectable({
  providedIn: 'root'
})
export class DemoLandingContentService {
  private readonly helpCenter = inject(DemoHelpCenterService);
  private readonly ideaPosts = inject(DemoIdeaPostsService);
  private readonly i18n = inject(I18nService);

  async loadContent(): Promise<LandingContentState> {
    const [privacy, ideas] = await Promise.all([
      this.helpCenter.loadState('privacy', this.i18n.currentLanguage()),
      this.ideaPosts.loadPublishedPosts(this.i18n.currentLanguage())
    ]);
    return { privacy, ideas };
  }
}
