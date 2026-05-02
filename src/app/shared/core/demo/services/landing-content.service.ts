import { Injectable, inject } from '@angular/core';

import type { LandingContentState } from '../../base/models';
import { DemoHelpCenterService } from './help-center.service';
import { DemoIdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class DemoLandingContentService {
  private readonly helpCenter = inject(DemoHelpCenterService);
  private readonly ideaPosts = inject(DemoIdeaPostsService);

  async loadContent(): Promise<LandingContentState> {
    const [privacy, ideas] = await Promise.all([
      this.helpCenter.loadState('privacy'),
      this.ideaPosts.loadPublishedPosts()
    ]);
    return { privacy, ideas };
  }
}
