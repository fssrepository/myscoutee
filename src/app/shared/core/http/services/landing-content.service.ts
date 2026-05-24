import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { HelpCenterState, LandingContentState } from '../../base/models';
import type { UserLocationEligibilityResponseDto } from '../../base/interfaces/user.interface';
import { HttpHelpCenterService } from './help-center.service';
import { HttpIdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class HttpLandingContentService {
  private readonly http = inject(HttpClient);
  private readonly helpCenter = inject(HttpHelpCenterService);
  private readonly ideaPosts = inject(HttpIdeaPostsService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadContent(): Promise<LandingContentState> {
    type LandingContentResponse = {
      privacy?: Partial<HelpCenterState> | null;
      ideas?: unknown;
      loginAvailability?: Partial<UserLocationEligibilityResponseDto> | null;
    };
    const lang = this.browserLanguage();
    const response = await this.http
      .get<LandingContentResponse | null>(`${this.apiBaseUrl}/landing/content`, {
        params: { lang }
      })
      .toPromise();
    return {
      privacy: this.helpCenter.normalizeExternalState(response?.privacy, 'privacy'),
      ideas: this.ideaPosts.normalizePosts(Array.isArray(response?.ideas) ? response?.ideas : []),
      loginAvailability: this.normalizeLoginAvailability(response?.loginAvailability)
    };
  }

  private normalizeLoginAvailability(
    response: Partial<UserLocationEligibilityResponseDto> | null | undefined
  ): UserLocationEligibilityResponseDto | null {
    if (!response) {
      return null;
    }
    const eligible = response?.eligible !== false;
    return {
      eligible,
      partitionKey: typeof response?.partitionKey === 'string' ? response.partitionKey : null,
      message: typeof response?.message === 'string' ? response.message : null,
      securityGateEnabled: response?.securityGateEnabled === true,
      locationRequired: response?.locationRequired === true
    };
  }

  private browserLanguage(): string {
    const languages = this.browserLanguages()
      .map(value => this.normalizeLanguage(value))
      .filter(Boolean);
    return languages.find(lang => lang !== 'en') ?? languages[0] ?? 'en';
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  }

  private normalizeLanguage(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
  }
}
