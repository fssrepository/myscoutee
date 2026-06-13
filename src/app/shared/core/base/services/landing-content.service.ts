import { Injectable, inject, signal } from '@angular/core';

import { LocalLandingContentService } from '../../local/source/services/landing-content.service';
import { HttpLandingContentService } from '../../http/services/landing-content.service';
import type { LandingContentState } from '../../contracts';
import type { InfoCardData } from '../../../ui';
import { BaseRouteModeService } from './base-route-mode.service';
import { IdeaPostsService } from './idea-posts.service';
import { PrivacyPolicyService } from './privacy-policy.service';
import { TermsPolicyService } from './terms-policy.service';

export interface LandingContentDisplayState {
  state: LandingContentState;
  ideaCards: InfoCardData[];
}

@Injectable({
  providedIn: 'root'
})
export class LandingContentService extends BaseRouteModeService {
  private static readonly LANDING_CONTENT_ROUTE = '/landing/content';
  private readonly localLandingContentService = inject(LocalLandingContentService);
  private readonly httpLandingContentService = inject(HttpLandingContentService);
  private readonly ideaPosts = inject(IdeaPostsService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly stateRef = signal<LandingContentState | null>(null);
  private loadPromise: Promise<LandingContentState> | null = null;
  private displayLoadPromise: Promise<LandingContentDisplayState> | null = null;

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
          this.privacyPolicy.applyState(cloned.privacy);
          this.termsPolicy.applyState(cloned.terms);
          this.ideaPosts.applyPublishedPosts(cloned.ideas);
          return this.cloneState(cloned);
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }
    return this.cloneState(await this.loadPromise);
  }

  async loadDisplayState(): Promise<LandingContentDisplayState> {
    const current = this.stateRef();
    if (current) {
      return this.cloneDisplayState(current);
    }
    if (!this.displayLoadPromise) {
      this.displayLoadPromise = this.loadOnce()
        .then(state => this.cloneDisplayState(state))
        .finally(() => {
          this.displayLoadPromise = null;
        });
    }
    return this.cloneDisplayState((await this.displayLoadPromise).state);
  }

  ideaInfoCards(): InfoCardData[] {
    return this.ideaPosts.publishedIdeaInfoCards().map(card => ({ ...card }));
  }

  usesLocalContent(): boolean {
    return this.isLocalRouteEnabled(LandingContentService.LANDING_CONTENT_ROUTE);
  }

  private landingService(): LocalLandingContentService | HttpLandingContentService {
    return this.resolveRouteService(
      LandingContentService.LANDING_CONTENT_ROUTE,
      this.localLandingContentService,
      this.httpLandingContentService
    );
  }

  private cloneDisplayState(state: LandingContentState): LandingContentDisplayState {
    return {
      state: this.cloneState(state),
      ideaCards: this.ideaInfoCards()
    };
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
        auditTrail: state.privacy.auditTrail.map(entry => ({ ...entry })),
        availableLanguages: state.privacy.availableLanguages.map(language => ({ ...language }))
      },
      terms: {
        activeRevision: state.terms.activeRevision
          ? {
              ...state.terms.activeRevision,
              sections: state.terms.activeRevision.sections.map(section => ({ ...section }))
            }
          : null,
        revisions: state.terms.revisions.map(revision => ({
          ...revision,
          sections: revision.sections.map(section => ({ ...section }))
        })),
        auditTrail: state.terms.auditTrail.map(entry => ({ ...entry })),
        availableLanguages: state.terms.availableLanguages.map(language => ({ ...language }))
      },
      ideas: state.ideas.map(post => ({ ...post, imageUrls: [...post.imageUrls] })),
      loginAvailability: state.loginAvailability
        ? {
            eligible: state.loginAvailability.eligible !== false,
            partitionKey: state.loginAvailability.partitionKey ?? null,
            message: state.loginAvailability.message ?? null,
            securityGateEnabled: state.loginAvailability.securityGateEnabled === true,
            locationRequired: false
          }
        : null
    };
  }
}
