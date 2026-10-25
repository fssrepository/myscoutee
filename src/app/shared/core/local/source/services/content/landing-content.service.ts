import { scheduleAfterPaint } from '@fssrepository/myscoutee-components';
import { LocalLandingContentRepository } from '../../repositories/content/landing-content.repository';
import { Injectable, Injector, inject } from '@angular/core';

import type { UserLocationEligibilityResponseDto } from '../../../../contracts/accounts/user.interface';
import type { HelpCenterStateDto, LandingContentStateDto } from '../../../../contracts';
import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';
import { LocalHelpCenterService } from '../help/help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';
import { LocalCountryPartitionsRepository } from '../../repositories/platform/country-partitions.repository';
import { I18nService } from '../../../../base/services/localization/i18n.service';

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
  private readonly i18n = inject(I18nService);

  async loadExplanationState(contextKey: string, language: string, groupId: string | null = null): Promise<HelpCenterStateDto> {
    return this.helpCenter.loadState('explanation', language, contextKey, groupId);
  }

  async loadContent(groupId: string | null = null): Promise<LandingContentStateDto> {
    const [content, delay] = await Promise.allSettled([
      this.readContent(groupId),
      this.routeDelay.waitForRouteDelay(LocalLandingContentService.LANDING_CONTENT_ROUTE)
    ]);
    if (delay.status === 'rejected') throw delay.reason;
    if (content.status === 'rejected') throw content.reason;
    return content.value;
  }

  private async readContent(groupId: string | null): Promise<LandingContentStateDto> {
    // Match popup preparation: paint the loader before importing and preparing content.
    await new Promise<void>(resolve => { scheduleAfterPaint(resolve); });
    const { SeedStaticContentService } = await import('../../../seed/services/platform/static-content.service');
    await this.injector.get(SeedStaticContentService).ensureReady();
    const language = this.i18n.currentLanguage();
    const [privacy, terms, ideaPreview, slides] = await Promise.all([
      this.helpCenter.readState('privacy', language, undefined, groupId),
      this.helpCenter.readState('terms', language, undefined, groupId),
      this.ideaPosts.loadPublishedFeaturedPostPreview(language, groupId),
      this.content.querySlides(groupId)
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
