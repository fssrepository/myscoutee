import { Injectable, inject, signal } from '@angular/core';

import { DemoLandingContentService } from '../../demo/services/landing-content.service';
import { HttpLandingContentService } from '../../http/services/landing-content.service';
import type { LandingContentState } from '../models';
import { BaseRouteModeService } from './base-route-mode.service';
import { HelpCenterService } from './help-center.service';
import { IdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class LandingContentService extends BaseRouteModeService {
  private readonly demoLandingContentService = inject(DemoLandingContentService);
  private readonly httpLandingContentService = inject(HttpLandingContentService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly ideaPosts = inject(IdeaPostsService);
  private readonly stateRef = signal<LandingContentState | null>(null);
  private loadPromise: Promise<LandingContentState> | null = null;

  readonly state = this.stateRef.asReadonly();

  async loadOnce(): Promise<LandingContentState> {
    const current = this.stateRef();
    if (current) {
      return this.cloneState(current);
    }
    if (!this.loadPromise) {
      this.loadPromise = this.landingService().loadContent()
        .then(state => {
          const cloned = this.cloneState(state);
          this.stateRef.set(cloned);
          this.helpCenter.applyState('privacy', cloned.privacy);
          this.ideaPosts.applyPublishedPosts(cloned.ideas);
          return this.cloneState(cloned);
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }
    return this.cloneState(await this.loadPromise);
  }

  private landingService(): DemoLandingContentService | HttpLandingContentService {
    return this.resolveRouteService('/landing/content', this.demoLandingContentService, this.httpLandingContentService);
  }

  private cloneState(state: LandingContentState): LandingContentState {
    return {
      privacy: {
        activeRevision: state.privacy.activeRevision
          ? {
              ...state.privacy.activeRevision,
              sections: state.privacy.activeRevision.sections.map(section => ({ ...section }))
            }
          : null,
        revisions: state.privacy.revisions.map(revision => ({
          ...revision,
          sections: revision.sections.map(section => ({ ...section }))
        })),
        auditTrail: state.privacy.auditTrail.map(entry => ({ ...entry }))
      },
      ideas: state.ideas.map(post => ({ ...post, imageUrls: [...post.imageUrls] }))
    };
  }
}
