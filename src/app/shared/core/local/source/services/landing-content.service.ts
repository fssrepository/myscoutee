import { Injectable, inject } from '@angular/core';

import type { UserLocationEligibilityResponseDto } from '../../../contracts/user.interface';
import type { LandingContentStateDto } from '../../../contracts';
import { RouteDelayService } from '../../../base/services/route-delay.service';
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

  private readonly helpCenter = inject(LocalHelpCenterService);
  private readonly ideaPosts = inject(LocalIdeaPostsService);
  private readonly routeDelay = inject(RouteDelayService);

  async loadContent(): Promise<LandingContentStateDto> {
    const [privacy, terms, ideaPreview] = await Promise.all([
      this.helpCenter.loadState('privacy'),
      this.helpCenter.loadState('terms'),
      this.ideaPosts.loadPublishedFeaturedPostPreview(),
      this.routeDelay.waitForRouteDelay(LocalLandingContentService.LANDING_CONTENT_ROUTE)
    ]);
    return {
      privacy,
      terms,
      ideas: ideaPreview.records,
      ideasTotal: ideaPreview.total,
      loginAvailability: LocalLandingContentService.DEMO_LOGIN_AVAILABILITY
    };
  }

}
