import { LocalLandingContentRepository } from '../repositories/landing-content.repository';
import { Injectable, Injector, inject } from '@angular/core';

import type { UserLocationEligibilityResponseDto } from '../../../contracts/user.interface';
import type { HelpCenterStateDto, LandingContentStateDto } from '../../../contracts';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';
import { LocalCountryPartitionsRepository } from '../repositories/country-partitions.repository';

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

  private readonly content = inject(LocalLandingContentRepository);
  private readonly injector = inject(Injector);
  private readonly helpCenter = inject(LocalHelpCenterService);
  private readonly ideaPosts = inject(LocalIdeaPostsService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly countryPartitions = inject(LocalCountryPartitionsRepository);

  async loadExplanationState(contextKey: string, language: string, groupId: string | null = null): Promise<HelpCenterStateDto> {
    return this.helpCenter.loadState('explanation', language, contextKey, groupId);
  }

  async loadContent(groupId: string | null = null): Promise<LandingContentStateDto> {
    const { SeedStaticContentService } = await import('../../seed/services/static-content.service');
    await this.injector.get(SeedStaticContentService).ensureReady();
    const [privacy, terms, ideaPreview, slides] = await Promise.all([
      this.helpCenter.loadState('privacy', undefined, undefined, groupId),
      this.helpCenter.loadState('terms', undefined, undefined, groupId),
      this.ideaPosts.loadPublishedFeaturedPostPreview(undefined, groupId),
      this.content.querySlides(groupId),
      this.routeDelay.waitForRouteDelay(LocalLandingContentService.LANDING_CONTENT_ROUTE)
    ]);
    return {
      groupId,
      slides,
      privacy,
      terms,
      ideas: ideaPreview.records,
      ideasTotal: ideaPreview.total,
      supportedCountries: this.countryPartitions.querySupportedCountries(),
      loginAvailability: LocalLandingContentService.DEMO_LOGIN_AVAILABILITY
    };
  }

}
