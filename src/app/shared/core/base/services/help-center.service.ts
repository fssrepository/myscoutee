import { GroupWorkspaceContextService } from './group-workspace-context.service';
import { baseGroupId } from '../../contracts/group-type';
import {
  Injectable,
  computed,
  effect,
  untracked,
  inject,
  signal
} from '@angular/core';

import {
  LocalHelpCenterService
} from '../../local/source/services/help-center.service';
import {
  HttpHelpCenterService
} from '../../http/services/help-center.service';
import type { GuideDocumentKind as HelpCenterDocumentKind } from '@myscoutee/components';
import type { HelpCenterRevisionSaveRequestDto, HelpCenterStateDto, PrivacyConsentDto, PrivacyConsentSaveRequestDto } from '../../contracts';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import { HelpCenterStore } from '../../../ui/context/stores/app/help-center.store';

export const HELP_CENTER_LOAD_CONTEXT_KEY = 'help-center-load';

@Injectable({
  providedIn: 'root'
})
export class HelpCenterService extends BaseRouteModeService {
  private readonly localHelpCenterService = inject(LocalHelpCenterService);
  private readonly httpHelpCenterService = inject(HttpHelpCenterService);
  private readonly helpCenterStore = inject(HelpCenterStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  readonly landingGroupId = signal<string | null>(null);
  private readonly contentGroupId = computed(() => this.workspace.accountUserId()
    ? baseGroupId(this.workspace.groupType()) : this.landingGroupId());
  private readonly helpStateRef = signal<HelpCenterStateDto | null>(null);
  private readonly privacyStateRef = signal<HelpCenterStateDto | null>(null);
  private readonly termsStateRef = signal<HelpCenterStateDto | null>(null);
  private readonly explanationStateRef = signal<HelpCenterStateDto | null>(null);
  private readonly stateGroups = new Map<HelpCenterDocumentKind, string | null>();
  private preloadPromises: Partial<Record<string, Promise<HelpCenterStateDto>>> = {};

  readonly state = this.helpStateRef.asReadonly();
  readonly privacyState = this.privacyStateRef.asReadonly();
  readonly termsState = this.termsStateRef.asReadonly();
  readonly explanationState = this.explanationStateRef.asReadonly();
  readonly activeRevision = computed(() => this.helpStateRef()?.activeRevision ?? null);
  readonly activePrivacyRevision = computed(() => this.privacyStateRef()?.activeRevision ?? null);
  readonly activeTermsRevision = computed(() => this.termsStateRef()?.activeRevision ?? null);
  readonly activeExplanationRevision = computed(() => this.explanationStateRef()?.activeRevision ?? null);
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly hasActivePrivacyRevision = computed(() => Boolean(this.activePrivacyRevision()));
  readonly hasActiveTermsRevision = computed(() => Boolean(this.activeTermsRevision()));
  readonly hasActiveExplanationRevision = computed(() => Boolean(this.activeExplanationRevision()));
  readonly activeVersionLabel = computed(() => this.versionLabel(this.activeRevision()?.version));
  readonly activePrivacyVersionLabel = computed(() => this.versionLabel(this.activePrivacyRevision()?.version));
  readonly activeTermsVersionLabel = computed(() => this.versionLabel(this.activeTermsRevision()?.version));
  readonly activeExplanationVersionLabel = computed(() => this.versionLabel(this.activeExplanationRevision()?.version));

  constructor() {
    super();
    let current = this.contentGroupId();
    effect(() => {
      const next = this.contentGroupId();
      if (next === current) return;
      current = next;
      untracked(() => {
        if (this.stateGroups.get('help') !== next) this.helpStateRef.set(null);
        if (this.stateGroups.get('terms') !== next) this.termsStateRef.set(null);
        if (this.stateGroups.get('explanation') !== next) this.explanationStateRef.set(null);
      });
    });
  }

  async preload(kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    const documentKind = this.normalizeKind(kind);
    const key = `${documentKind === 'privacy' ? 'website' : this.contentGroupId() ?? 'dating'}:${documentKind}`;
    if (!this.preloadPromises[key]) {
      this.preloadPromises[key] = this.loadState(documentKind).finally(() => {
        delete this.preloadPromises[key];
      });
    }
    return this.preloadPromises[key]!;
  }

  async preloadAll(): Promise<void> {
    await Promise.all([
      this.preload('help'),
      this.preload('privacy'),
      this.preload('terms')
    ]);
  }

  applyState(kind: HelpCenterDocumentKind, state: HelpCenterStateDto): void {
    this.setState(this.normalizeKind(kind), state);
  }

  async refresh(kind: HelpCenterDocumentKind = 'help', contextKey?: string | null): Promise<HelpCenterStateDto> {
    return this.loadState(this.normalizeKind(kind), undefined, contextKey);
  }

  async loadExplanationState(contextKey: string, lang?: string | null): Promise<HelpCenterStateDto> {
    return this.loadState('explanation', lang, contextKey);
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentDto | null> {
    const consent = await this.privacyConsentService().loadPrivacyConsent(userId, revisionId, revisionVersion);
    return consent ? this.clonePrivacyConsent(consent) : null;
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequestDto): Promise<PrivacyConsentDto> {
    return this.clonePrivacyConsent(await this.privacyConsentService().savePrivacyConsent(request));
  }

  async loadAdminState(adminUserId: string, kind: HelpCenterDocumentKind = 'help', lang = 'en', contextKey?: string | null): Promise<HelpCenterStateDto> {
    const groupId = this.contentGroupId();
    const documentKind = this.normalizeKind(kind);
    const service = this.helpService(documentKind);
    const state = await service.loadAdminState(adminUserId, documentKind, lang, contextKey);
    if (groupId === this.contentGroupId()) this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequestDto, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    const groupId = this.contentGroupId();
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).saveRevision(request, documentKind);
    if (groupId === this.contentGroupId()) this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    const groupId = this.contentGroupId();
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).activateRevision(revisionId, actorUserId, documentKind);
    if (groupId === this.contentGroupId()) this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    const groupId = this.contentGroupId();
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).deleteRevision(revisionId, actorUserId, documentKind);
    if (groupId === this.contentGroupId()) this.setState(documentKind, state);
    return this.cloneState(state);
  }

  private async loadState(kind: HelpCenterDocumentKind, lang?: string | null, contextKey?: string | null): Promise<HelpCenterStateDto> {
    const groupId = kind === 'privacy' ? null : this.contentGroupId();
    const state = await this.helpService(kind).loadState(kind, lang, contextKey, groupId);
    if (kind === 'privacy' || groupId === this.contentGroupId()) this.setState(kind, state);
    return this.cloneState(state);
  }

  private helpService(kind: HelpCenterDocumentKind): LocalHelpCenterService | HttpHelpCenterService {
    return this.resolveRouteService(`/${kind}/active`, this.localHelpCenterService, this.httpHelpCenterService);
  }

  private privacyConsentService(): LocalHelpCenterService | HttpHelpCenterService {
    return this.resolveRouteService('/privacy/consents', this.localHelpCenterService, this.httpHelpCenterService);
  }

  private setState(kind: HelpCenterDocumentKind, state: HelpCenterStateDto): void {
    this.stateGroups.set(kind, kind === 'privacy' ? null : this.contentGroupId());
    const cloned = this.cloneState(state);
    if (kind === 'privacy') {
      this.privacyStateRef.set(cloned);
      this.helpCenterStore.setPrivacyState(cloned);
      return;
    }
    if (kind === 'terms') {
      this.termsStateRef.set(cloned);
      return;
    }
    if (kind === 'explanation') {
      this.explanationStateRef.set(cloned);
      return;
    }
    this.helpStateRef.set(cloned);
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    if (kind === 'privacy' || kind === 'terms' || kind === 'explanation') {
      return kind;
    }
    return 'help';
  }

  private versionLabel(version: number | null | undefined): string {
    return Number.isFinite(Number(version)) && Number(version) > 0 ? `v${Math.trunc(Number(version))}` : '';
  }

  private cloneState(state: HelpCenterStateDto): HelpCenterStateDto {
    return {
      activeRevision: state.activeRevision
        ? {
            ...state.activeRevision,
            sections: state.activeRevision.sections.map(section => ({
              ...section,
              imageUrls: [...(section.imageUrls ?? [])]
            }))
          }
        : null,
      revisions: state.revisions.map(revision => ({
        ...revision,
        sections: revision.sections.map(section => ({
          ...section,
          imageUrls: [...(section.imageUrls ?? [])]
        }))
      })),
      auditTrail: state.auditTrail.map(entry => ({ ...entry })),
      availableLanguages: state.availableLanguages.map(language => ({ ...language })),
      guideFields: state.guideFields.map(field => ({ ...field }))
    };
  }

  private clonePrivacyConsent(consent: PrivacyConsentDto): PrivacyConsentDto {
    return {
      ...consent,
      approvedOptionalSectionIds: [...consent.approvedOptionalSectionIds]
    };
  }
}
