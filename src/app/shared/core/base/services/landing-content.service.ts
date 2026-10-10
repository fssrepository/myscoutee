import { HelpCenterService } from './help-center.service';
import { baseGroupId, type GroupType } from '../../contracts/group-type';
import { Injectable, inject, signal } from '@angular/core';

import { LocalLandingContentService } from '../../local/source/services/landing-content.service';
import { HttpLandingContentService } from '../../http/services/landing-content.service';
import type { HelpCenterStateDto, LandingContentStateDto } from '../../contracts';
import type { InfoCardData } from '@myscoutee/components';
import { BaseRouteModeService } from './base-route-mode.service';
import { IdeaPostsService } from './idea-posts.service';
import { PrivacyPolicyService } from './privacy-policy.service';
import { TermsPolicyService } from './terms-policy.service';

export interface LandingContentDisplayState {
  state: LandingContentStateDto;
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
  private readonly helpCenter = inject(HelpCenterService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly stateRef = signal<LandingContentStateDto | null>(null);
  private readonly states = new Map<string, LandingContentStateDto>();
  private readonly loads = new Map<string, Promise<LandingContentStateDto>>();
  readonly mode = signal<GroupType>('dating');

  readonly state = this.stateRef.asReadonly();

  async loadExplanationState(contextKey: string, language: string): Promise<HelpCenterStateDto> {
    return this.landingService().loadExplanationState(contextKey, language, baseGroupId(this.mode()));
  }

  async loadOnce(groupId: string | null = baseGroupId(this.mode())): Promise<LandingContentStateDto> {
    const key = groupId ?? 'dating';
    const cached = this.states.get(key);
    if (cached) return this.cloneState(cached);
    let pending = this.loads.get(key);
    if (!pending) {
      pending = this.landingService().loadContent(groupId).then(state => {
        const cloned = this.cloneState(state);
        this.states.set(key, cloned);

        return cloned;
      }).finally(() => this.loads.delete(key));
      this.loads.set(key, pending);
    }
    return this.cloneState(await pending);
  }

  async loadDisplayState(groupId: string | null = baseGroupId(this.mode())): Promise<LandingContentDisplayState> {
    this.helpCenter.landingGroupId.set(groupId);
    const state = await this.loadOnce(groupId);
    if (groupId === baseGroupId(this.mode())) {
      this.privacyPolicy.applyState(state.privacy);
      this.termsPolicy.applyState(state.terms);
      this.stateRef.set(state);
      this.ideaPosts.applyPublishedPosts(state.ideas);
    }
    return this.cloneDisplayState(state);
  }

  ideaInfoCards(): InfoCardData[] {
    return this.ideaPosts.publishedIdeaInfoCards().map(card => ({ ...card }));
  }

  private landingService(): LocalLandingContentService | HttpLandingContentService {
    return this.resolveRouteService(
      LandingContentService.LANDING_CONTENT_ROUTE,
      this.localLandingContentService,
      this.httpLandingContentService
    );
  }

  private cloneDisplayState(state: LandingContentStateDto): LandingContentDisplayState {
    return {
      state: this.cloneState(state),
      ideaCards: this.ideaPosts.publishedIdeaInfoCards(state.ideas)
    };
  }

  private cloneState(state: LandingContentStateDto): LandingContentStateDto {
    return {
      groupId: state.groupId ?? null,
      slides: (state.slides ?? []).map(slide => ({ ...slide })),
      supportedCountries: (state.supportedCountries ?? []).map(country => ({ ...country })),
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
        availableLanguages: state.privacy.availableLanguages.map(language => ({ ...language })),
        guideFields: state.privacy.guideFields.map(field => ({ ...field }))
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
        availableLanguages: state.terms.availableLanguages.map(language => ({ ...language })),
        guideFields: state.terms.guideFields.map(field => ({ ...field }))
      },
      ideas: state.ideas.map(post => ({ ...post, imageUrls: [...post.imageUrls] })),
      ideasTotal: Math.max(
        state.ideas.length,
        Math.max(0, Math.trunc(Number(state.ideasTotal) || 0))
      ),
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
