import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { HelpCenterState, LandingContentState } from '../../base/models';
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
    };
    const response = await this.http
      .get<LandingContentResponse | null>(`${this.apiBaseUrl}/landing/content`)
      .toPromise();
    return {
      privacy: this.helpCenter.normalizeExternalState(response?.privacy, 'privacy'),
      ideas: this.ideaPosts.normalizePosts(Array.isArray(response?.ideas) ? response?.ideas : [])
    };
  }
}
