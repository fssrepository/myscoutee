import { Injectable, computed, inject, signal } from '@angular/core';

import { LocalHelpCenterService } from '../../local/services/help-center.service';
import { HttpHelpCenterService } from '../../http/services/help-center.service';
import type {
  HelpCenterDocumentKind,
  HelpCenterRevisionSaveRequest,
  HelpCenterState,
  PrivacyConsentRecord,
  PrivacyConsentSaveRequest
} from '../models';
import { AppContext } from '../context/app.context';
import { BaseRouteModeService } from './base-route-mode.service';

export const HELP_CENTER_LOAD_CONTEXT_KEY = 'help-center-load';

@Injectable({
  providedIn: 'root'
})
export class HelpCenterService extends BaseRouteModeService {
  private readonly localHelpCenterService = inject(LocalHelpCenterService);
  private readonly httpHelpCenterService = inject(HttpHelpCenterService);
  private readonly appCtx = inject(AppContext);
  private readonly helpStateRef = signal<HelpCenterState | null>(null);
  private readonly privacyStateRef = signal<HelpCenterState | null>(null);
  private readonly explanationStateRef = signal<HelpCenterState | null>(null);
  private preloadPromises: Partial<Record<HelpCenterDocumentKind, Promise<HelpCenterState>>> = {};

  readonly state = this.helpStateRef.asReadonly();
  readonly privacyState = this.privacyStateRef.asReadonly();
  readonly explanationState = this.explanationStateRef.asReadonly();
  readonly activeRevision = computed(() => this.helpStateRef()?.activeRevision ?? null);
  readonly activePrivacyRevision = computed(() => this.privacyStateRef()?.activeRevision ?? null);
  readonly activeExplanationRevision = computed(() => this.explanationStateRef()?.activeRevision ?? null);
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly hasActivePrivacyRevision = computed(() => Boolean(this.activePrivacyRevision()));
  readonly hasActiveExplanationRevision = computed(() => Boolean(this.activeExplanationRevision()));
  readonly activeVersionLabel = computed(() => this.versionLabel(this.activeRevision()?.version));
  readonly activePrivacyVersionLabel = computed(() => this.versionLabel(this.activePrivacyRevision()?.version));
  readonly activeExplanationVersionLabel = computed(() => this.versionLabel(this.activeExplanationRevision()?.version));

  async preload(kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    if (!this.preloadPromises[documentKind]) {
      this.preloadPromises[documentKind] = this.loadState(documentKind).finally(() => {
        delete this.preloadPromises[documentKind];
      });
    }
    return this.preloadPromises[documentKind]!;
  }

  async preloadAll(): Promise<void> {
    await Promise.all([
      this.preload('help'),
      this.preload('privacy')
    ]);
  }

  applyState(kind: HelpCenterDocumentKind, state: HelpCenterState): void {
    this.setState(this.normalizeKind(kind), state);
  }

  async refresh(kind: HelpCenterDocumentKind = 'help', contextKey?: string | null): Promise<HelpCenterState> {
    return this.loadState(this.normalizeKind(kind), undefined, contextKey);
  }

  async loadExplanationState(contextKey: string, lang?: string | null): Promise<HelpCenterState> {
    return this.loadState('explanation', lang, contextKey);
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentRecord | null> {
    const consent = await this.privacyConsentService().loadPrivacyConsent(userId, revisionId, revisionVersion);
    return consent ? this.clonePrivacyConsent(consent) : null;
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequest): Promise<PrivacyConsentRecord> {
    return this.clonePrivacyConsent(await this.privacyConsentService().savePrivacyConsent(request));
  }

  async loadAdminState(adminUserId: string, kind: HelpCenterDocumentKind = 'help', lang = 'en', contextKey?: string | null): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const service = this.helpService(documentKind);
    const state = await service.loadAdminState(adminUserId, documentKind, lang, contextKey);
    this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).saveRevision(request, documentKind);
    this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).activateRevision(revisionId, actorUserId, documentKind);
    this.setState(documentKind, state);
    return this.cloneState(state);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const state = await this.helpService(documentKind).deleteRevision(revisionId, actorUserId, documentKind);
    this.setState(documentKind, state);
    return this.cloneState(state);
  }

  private async loadState(kind: HelpCenterDocumentKind, lang?: string | null, contextKey?: string | null): Promise<HelpCenterState> {
    const state = await this.helpService(kind).loadState(kind, lang, contextKey);
    this.setState(kind, state);
    return this.cloneState(state);
  }

  private helpService(kind: HelpCenterDocumentKind): LocalHelpCenterService | HttpHelpCenterService {
    return this.resolveRouteService(`/${kind}/active`, this.localHelpCenterService, this.httpHelpCenterService);
  }

  private privacyConsentService(): LocalHelpCenterService | HttpHelpCenterService {
    return this.resolveRouteService('/privacy/consents', this.localHelpCenterService, this.httpHelpCenterService);
  }

  private setState(kind: HelpCenterDocumentKind, state: HelpCenterState): void {
    const cloned = this.cloneState(state);
    if (kind === 'privacy') {
      this.privacyStateRef.set(cloned);
      this.appCtx.setPrivacyState(cloned);
      return;
    }
    if (kind === 'explanation') {
      this.explanationStateRef.set(cloned);
      return;
    }
    this.helpStateRef.set(cloned);
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    if (kind === 'privacy' || kind === 'explanation') {
      return kind;
    }
    return 'help';
  }

  private versionLabel(version: number | null | undefined): string {
    return Number.isFinite(Number(version)) && Number(version) > 0 ? `v${Math.trunc(Number(version))}` : '';
  }

  private cloneState(state: HelpCenterState): HelpCenterState {
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
      availableLanguages: state.availableLanguages.map(language => ({ ...language }))
    };
  }

  private clonePrivacyConsent(consent: PrivacyConsentRecord): PrivacyConsentRecord {
    return {
      ...consent,
      approvedOptionalSectionIds: [...consent.approvedOptionalSectionIds]
    };
  }
}
