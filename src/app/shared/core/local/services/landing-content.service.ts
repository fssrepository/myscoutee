import { Injectable, inject } from '@angular/core';

import type { UserLocationEligibilityResponseDto } from '../../base/interfaces';
import type { LandingContentState } from '../../base/models';
import { LocalMemoryDb } from '../../base/db';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class LocalLandingContentService {
  private static readonly LANDING_CONTENT_ROUTE = '/landing/content';
  private static readonly DEMO_LOGIN_AVAILABILITY: UserLocationEligibilityResponseDto = {
    eligible: true,
    partitionKey: null,
    message: null,
    securityGateEnabled: false,
    locationRequired: false
  };

  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly helpCenter = inject(LocalHelpCenterService);
  private readonly ideaPosts = inject(LocalIdeaPostsService);
  private readonly routeDelay = inject(RouteDelayService);

  async loadContent(): Promise<LandingContentState> {
    await this.memoryDb.resetStorageOnce();
    await this.helpCenter.ensureEntryPrivacySeeded();
    const [privacy, ideas] = await Promise.all([
      this.helpCenter.loadState('privacy'),
      this.ideaPosts.loadPublishedPosts(),
      this.routeDelay.waitForRouteDelay(LocalLandingContentService.LANDING_CONTENT_ROUTE)
    ]);
    return { privacy, ideas, loginAvailability: LocalLandingContentService.DEMO_LOGIN_AVAILABILITY };
  }

}
