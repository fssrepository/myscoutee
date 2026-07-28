import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type {
  OperatorGroupingTokenDto,
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestKind,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto,
  OperatorRevenueDto
} from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import { UserProfileStore } from './user-profile.store';

export type OperatorWorkspaceBusyAction =
  | 'load-claim'
  | 'claim-share'
  | 'issue-grouping-token'
  | 'link-operator-group'
  | 'load-update'
  | 'apply-update'
  | 'load-configuration'
  | 'load-revenue'
  | 'save-branding'
  | 'register-payment'
  | 'register-firebase'
  | 'test-authentication'
  | 'test-messaging'
  | 'load-community'
  | 'set-community'
  | null;

export type OperatorConfigurationTestFeedback = 'success' | 'error' | null;

@Injectable({
  providedIn: 'root'
})
export class OperatorWorkspaceStore {
  private readonly service = inject(OperatorRegistryService);
  private readonly sessionService = inject(SessionService);
  private readonly leaderboard = inject(OperatorLeaderboardStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  private readonly claimStatusRef = signal<OperatorClaimStatusDto | null>(null);
  private readonly claimDraftRef = signal<OperatorClaimRequestDto>(
    this.emptyClaimDraft()
  );
  private readonly groupingTokenRef = signal<OperatorGroupingTokenDto | null>(null);
  private readonly groupTokenInputRef = signal('');
  private readonly deploymentUpdateRef = signal<OperatorDeploymentUpdateDto | null>(null);
  private readonly configurationRef = signal<OperatorConfigurationDto | null>(null);
  private readonly configurationDraftRef =
    signal<OperatorConfigurationSaveRequestDto | null>(null);
  private readonly configurationAuthenticationTestRef =
    signal<OperatorConfigurationTestResultDto | null>(null);
  private readonly configurationMessagingTestRef =
    signal<OperatorConfigurationTestResultDto | null>(null);
  private readonly configurationAuthenticationFeedbackRef =
    signal<OperatorConfigurationTestFeedback>(null);
  private readonly configurationMessagingFeedbackRef =
    signal<OperatorConfigurationTestFeedback>(null);
  private readonly revenueRef = signal<OperatorRevenueDto | null>(null);
  private readonly communityRef = signal<OperatorCommunityStatusDto | null>(null);
  private readonly busyActionRef = signal<OperatorWorkspaceBusyAction>(null);
  private readonly errorRef = signal('');
  private readonly noticeRef = signal('');
  private readonly feedbackActionRef =
    signal<Exclude<OperatorWorkspaceBusyAction, null> | null>(null);
  private requestGeneration = 0;
  private configurationAuthenticationFeedbackTimer:
    ReturnType<typeof setTimeout> | null = null;
  private configurationMessagingFeedbackTimer:
    ReturnType<typeof setTimeout> | null = null;
  private contextKey = this.sessionKey(this.sessionService.currentSession());

  readonly claimStatus = this.claimStatusRef.asReadonly();
  readonly claimDraft = this.claimDraftRef.asReadonly();
  readonly groupingToken = this.groupingTokenRef.asReadonly();
  readonly groupTokenInput = this.groupTokenInputRef.asReadonly();
  readonly deploymentUpdate = this.deploymentUpdateRef.asReadonly();
  readonly configuration = this.configurationRef.asReadonly();
  readonly configurationDraft = this.configurationDraftRef.asReadonly();
  readonly configurationAuthenticationTest =
    this.configurationAuthenticationTestRef.asReadonly();
  readonly configurationMessagingTest =
    this.configurationMessagingTestRef.asReadonly();
  readonly configurationAuthenticationFeedback =
    this.configurationAuthenticationFeedbackRef.asReadonly();
  readonly configurationMessagingFeedback =
    this.configurationMessagingFeedbackRef.asReadonly();
  readonly revenue = this.revenueRef.asReadonly();
  readonly community = this.communityRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly notice = this.noticeRef.asReadonly();
  readonly feedbackAction = this.feedbackActionRef.asReadonly();
  readonly claimVerificationReady = computed(() => {
    const status = this.claimStatusRef();
    const draft = this.claimDraftRef();
    return (
      status?.verificationCapability === 'AVAILABLE'
      && status.verificationStatus !== 'PENDING_REVIEW'
      && !status.claimed
      && Boolean(draft.legalName.trim())
      && Boolean(draft.registrationNumber.trim())
      && Boolean(draft.jurisdiction.trim())
      && Boolean(draft.registeredAddress.trim())
      && Boolean(draft.verificationContactName.trim())
      && Boolean(draft.verificationContactRole.trim())
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        draft.verificationContactEmail.trim()
      )
      && this.validPublicWebsite(draft.website)
      && draft.authorityAttested
    );
  });
  readonly configurationUploadOwnerId = computed(() => {
    const session = this.sessionService.currentSession();
    return this.userProfileStore.activeUserProfile()?.id?.trim()
      || (session?.kind === 'demo' ? session.userId.trim() : '')
      || 'operator-branding';
  });
  readonly configurationDirty = computed(() => {
    const configuration = this.configurationRef();
    const draft = this.configurationDraftRef();
    if (!configuration || !draft || configuration.capability !== 'AVAILABLE') {
      return false;
    }
    return (
      draft.branding.productName.trim() !== configuration.branding.productName
      || draft.branding.homeLabel.trim() !== configuration.branding.homeLabel
      || draft.branding.logoUrl.trim() !== configuration.branding.logoUrl
      || draft.branding.logoCharacterIndex
        !== configuration.branding.logoCharacterIndex
      || draft.branding.themePreset !== configuration.branding.themePreset
      || (draft.payment.providerId ?? '') !== (configuration.payment.providerId ?? '')
      || Boolean(draft.payment.credential.trim())
      || draft.firebase.projectId.trim() !== configuration.firebase.projectId
      || Boolean(draft.firebase.authenticationCredential.trim())
      || Boolean(draft.firebase.messagingCredential.trim())
    );
  });
  readonly configurationBrandingReady = computed(() => {
    const draft = this.configurationDraftRef();
    if (!draft?.branding.productName.trim() || !draft.branding.homeLabel.trim()) {
      return false;
    }
    const index = draft.branding.logoCharacterIndex;
    return index === null
      || (
        Number.isInteger(index)
        && index >= 0
        && index < Array.from(draft.branding.productName.trim()).length
      );
  });

  constructor() {
    effect(() => {
      const nextContextKey = this.sessionKey(this.sessionService.session());
      if (nextContextKey === this.contextKey) {
        return;
      }
      this.contextKey = nextContextKey;
      this.reset();
    });
  }

  async loadClaimStatus(): Promise<OperatorClaimStatusDto | null> {
    const result = await this.run('load-claim', () => this.service.loadClaimStatus());
    if (result) {
      this.claimStatusRef.set(result);
      this.seedClaimContact();
    }
    return result;
  }

  async issueGroupingToken(): Promise<OperatorGroupingTokenDto | null> {
    const result = await this.run(
      'issue-grouping-token',
      () => this.service.issueGroupingToken()
    );
    if (result) {
      this.groupingTokenRef.set(result);
      this.noticeRef.set('operator.group.token.issued');
    }
    return result;
  }

  async claimShare(): Promise<OperatorClaimStatusDto | null> {
    if (!this.claimVerificationReady()) {
      this.feedbackActionRef.set('claim-share');
      this.errorRef.set('operator.claim.verification.error.required');
      return null;
    }
    const draft = structuredClone(this.claimDraftRef());
    const result = await this.run(
      'claim-share',
      () => this.service.claimShare(draft)
    );
    if (result) {
      this.claimStatusRef.set(result);
      this.noticeRef.set(
        result.verificationStatus === 'PENDING_REVIEW'
          ? 'operator.claim.verification.submitted'
          : 'operator.claim.completed'
      );
      if (result.claimed) {
        this.leaderboard.invalidate();
      }
    }
    return result;
  }

  async linkOperatorGroup(): Promise<OperatorClaimStatusDto | null> {
    const clientToken = this.groupTokenInputRef().trim();
    if (!clientToken) {
      this.errorRef.set('operator.claim.client.code.required');
      return null;
    }
    const result = await this.run(
      'link-operator-group',
      () => this.service.linkOperatorGroup(clientToken)
    );
    if (result) {
      this.claimStatusRef.set(result);
      this.groupTokenInputRef.set('');
      this.noticeRef.set('operator.claim.client.code.submitted');
      if (
        result.verificationStatus === 'APPROVED'
        || result.verificationStatus === 'VERIFIED'
      ) {
        this.leaderboard.invalidate();
      }
    }
    return result;
  }

  async loadDeploymentUpdate(
    force = false
  ): Promise<OperatorDeploymentUpdateDto | null> {
    const cached = this.deploymentUpdateRef();
    if (cached && !force) {
      return cached;
    }
    const result = await this.run(
      'load-update',
      () => this.service.loadDeploymentUpdate()
    );
    if (result) {
      this.deploymentUpdateRef.set(result);
    }
    return result;
  }

  async refreshDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto | null> {
    return this.loadDeploymentUpdate(true);
  }

  async applyDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto | null> {
    const result = await this.run(
      'apply-update',
      () => this.service.applyDeploymentUpdate(progress => {
        this.deploymentUpdateRef.update(current =>
          current
            ? {
                ...current,
                progress
              }
            : current
        );
      })
    );
    if (result) {
      this.deploymentUpdateRef.set(result);
      if (result.progress.phase === 'COMPLETED') {
        this.noticeRef.set('operator.update.completed');
      } else if (result.progress.phase === 'FAILED') {
        this.errorRef.set(result.progress.message || 'operator.update.error.failed');
      }
    }
    return result;
  }

  async loadConfiguration(): Promise<OperatorConfigurationDto | null> {
    const result = await this.run(
      'load-configuration',
      () => this.service.loadConfiguration()
    );
    if (result) {
      this.configurationRef.set(result);
      this.configurationDraftRef.set(this.configurationDraftFrom(result));
      this.deploymentConfiguration.applyBranding(result.branding);
    }
    return result;
  }

  async loadRevenue(): Promise<OperatorRevenueDto | null> {
    const cached = this.revenueRef();
    if (cached) {
      return cached;
    }
    const result = await this.run(
      'load-revenue',
      () => this.service.loadRevenue()
    );
    if (result) {
      this.revenueRef.set(result);
    }
    return result;
  }

  async saveConfiguration(
    action: 'save-branding' | 'register-payment' | 'register-firebase',
    noticeKey = 'operator.configuration.saved'
  ): Promise<OperatorConfigurationDto | null> {
    const configuration = this.configurationRef();
    const draft = this.configurationDraftRef();
    if (
      !configuration
      || configuration.capability !== 'AVAILABLE'
      || !draft
    ) {
      this.errorRef.set(
        configuration?.unavailableReason
        || 'operator.configuration.backend.unavailable'
      );
      return null;
    }
    const result = await this.run(
      action,
      () => this.service.saveConfiguration(structuredClone(draft))
    );
    if (result) {
      this.configurationRef.set(result);
      this.configurationDraftRef.set(this.configurationDraftFrom(result));
      this.configurationAuthenticationTestRef.set(null);
      this.configurationMessagingTestRef.set(null);
      this.clearConfigurationTestFeedback();
      this.deploymentConfiguration.applyBranding(result.branding);
      this.noticeRef.set(noticeKey);
    }
    return result;
  }

  async testConfiguration(
    kind: OperatorConfigurationTestKind
  ): Promise<OperatorConfigurationTestResultDto | null> {
    this.clearConfigurationTestFeedback(kind);
    if (kind === 'FIREBASE_AUTHENTICATION') {
      this.configurationAuthenticationTestRef.set(null);
    } else {
      this.configurationMessagingTestRef.set(null);
    }
    const result = await this.run(
      kind === 'FIREBASE_AUTHENTICATION' ? 'test-authentication' : 'test-messaging',
      () => this.service.testConfiguration({ kind })
    );
    if (result) {
      if (kind === 'FIREBASE_AUTHENTICATION') {
        this.configurationAuthenticationTestRef.set(result);
      } else {
        this.configurationMessagingTestRef.set(result);
      }
      this.showConfigurationTestFeedback(
        kind,
        result.success ? 'success' : 'error'
      );
    } else if (this.errorRef()) {
      const failure: OperatorConfigurationTestResultDto = {
        kind,
        success: false,
        message: this.errorRef(),
        testedAt: new Date().toISOString()
      };
      if (kind === 'FIREBASE_AUTHENTICATION') {
        this.configurationAuthenticationTestRef.set(failure);
      } else {
        this.configurationMessagingTestRef.set(failure);
      }
      this.showConfigurationTestFeedback(kind, 'error');
    }
    return result;
  }

  async loadCommunityStatus(): Promise<OperatorCommunityStatusDto | null> {
    const result = await this.run(
      'load-community',
      () => this.service.loadCommunityStatus()
    );
    if (result) {
      this.communityRef.set(result);
    }
    return result;
  }

  async setCommunityAvailability(
    availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto | null> {
    const result = await this.run(
      'set-community',
      () => this.service.setCommunityAvailability(availability)
    );
    if (result) {
      this.communityRef.set(result);
      this.noticeRef.set('operator.community.updated');
    }
    return result;
  }

  clearFeedback(): void {
    this.errorRef.set('');
    this.noticeRef.set('');
    this.feedbackActionRef.set(null);
    this.configurationAuthenticationTestRef.set(null);
    this.configurationMessagingTestRef.set(null);
    this.revenueRef.set(null);
    this.clearConfigurationTestFeedback();
  }

  setGroupTokenInput(value: string): void {
    this.groupTokenInputRef.set(`${value ?? ''}`);
  }

  setClaimDraft(patch: Partial<OperatorClaimRequestDto>): void {
    this.claimDraftRef.update(current => ({
      ...current,
      ...patch
    }));
  }

  setConfigurationBranding(
    patch: Partial<OperatorConfigurationSaveRequestDto['branding']>
  ): void {
    this.configurationDraftRef.update(current => current
      ? {
          ...current,
          branding: {
            ...current.branding,
            ...patch
          }
        }
      : current
    );
  }

  setConfigurationPayment(
    patch: Partial<OperatorConfigurationSaveRequestDto['payment']>
  ): void {
    this.configurationDraftRef.update(current => current
      ? {
          ...current,
          payment: {
            ...current.payment,
            ...patch
          }
        }
      : current
    );
  }

  setConfigurationFirebase(
    patch: Partial<OperatorConfigurationSaveRequestDto['firebase']>
  ): void {
    this.configurationDraftRef.update(current => current
      ? {
          ...current,
          firebase: {
            ...current.firebase,
            ...patch
          }
        }
      : current
    );
  }

  private async run<T>(
    action: Exclude<OperatorWorkspaceBusyAction, null>,
    request: () => Promise<T>
  ): Promise<T | null> {
    const generation = ++this.requestGeneration;
    this.busyActionRef.set(action);
    this.feedbackActionRef.set(action);
    this.errorRef.set('');
    this.noticeRef.set('');
    try {
      const result = await request();
      return generation === this.requestGeneration ? result : null;
    } catch (error) {
      if (generation === this.requestGeneration) {
        this.errorRef.set(this.messageFromError(error));
      }
      return null;
    } finally {
      if (generation === this.requestGeneration) {
        this.busyActionRef.set(null);
      }
    }
  }

  private reset(): void {
    this.requestGeneration += 1;
    this.claimStatusRef.set(null);
    this.claimDraftRef.set(this.emptyClaimDraft());
    this.groupingTokenRef.set(null);
    this.groupTokenInputRef.set('');
    this.deploymentUpdateRef.set(null);
    this.configurationRef.set(null);
    this.configurationDraftRef.set(null);
    this.configurationAuthenticationTestRef.set(null);
    this.configurationMessagingTestRef.set(null);
    this.communityRef.set(null);
    this.busyActionRef.set(null);
    this.clearFeedback();
  }

  private sessionKey(session: AppSession | null): string {
    if (session?.kind === 'demo') {
      return `demo:${session.userId.trim()}`;
    }
    if (session?.kind === 'firebase') {
      return `firebase:${session.profile.id.trim()}`;
    }
    return 'none';
  }

  private configurationDraftFrom(
    configuration: OperatorConfigurationDto
  ): OperatorConfigurationSaveRequestDto {
    return {
      branding: {
        productName: configuration.branding.productName,
        homeLabel: configuration.branding.homeLabel,
        logoUrl: configuration.branding.logoUrl,
        logoCharacterIndex: configuration.branding.logoCharacterIndex,
        themePreset: configuration.branding.themePreset
      },
      payment: {
        providerId: configuration.payment.providerId,
        credential: ''
      },
      firebase: {
        projectId: configuration.firebase.projectId,
        authenticationCredential: '',
        messagingCredential: ''
      }
    };
  }

  private messageFromError(error: unknown): string {
    if (error && typeof error === 'object') {
      const source = error as {
        error?: { message?: unknown; detail?: unknown };
        message?: unknown;
        name?: unknown;
      };
      const serverMessage = typeof source.error?.message === 'string'
        ? source.error.message.trim()
        : typeof source.error?.detail === 'string'
          ? source.error.detail.trim()
          : '';
      if (serverMessage) {
        return serverMessage;
      }
      if (source.name === 'TimeoutError') {
        return 'operator.request.timeout';
      }
      if (typeof source.message === 'string' && source.message.trim()) {
        return source.message.trim();
      }
    }
    return 'operator.request.failed';
  }

  private emptyClaimDraft(): OperatorClaimRequestDto {
    return {
      legalName: '',
      registrationNumber: '',
      jurisdiction: '',
      registeredAddress: '',
      website: '',
      verificationContactName: '',
      verificationContactRole: '',
      verificationContactEmail: '',
      authorityAttested: false
    };
  }

  private seedClaimContact(): void {
    const profile = this.userProfileStore.activeUserProfile();
    const session = this.sessionService.currentSession();
    if (!profile && session?.kind !== 'firebase') {
      return;
    }
    this.claimDraftRef.update(current => ({
      ...current,
      verificationContactName:
        current.verificationContactName
        || profile?.name?.trim()
        || (session?.kind === 'firebase' ? session.profile.name.trim() : ''),
      verificationContactEmail:
        current.verificationContactEmail
        || (session?.kind === 'firebase' ? session.profile.email.trim() : '')
    }));
  }

  private validPublicWebsite(value: string | null | undefined): boolean {
    const source = `${value ?? ''}`.trim();
    if (!source) {
      return false;
    }
    try {
      const url = new URL(source);
      return (
        url.protocol === 'https:'
        && !url.username
        && !url.password
      );
    } catch {
      return false;
    }
  }

  private showConfigurationTestFeedback(
    kind: OperatorConfigurationTestKind,
    state: Exclude<OperatorConfigurationTestFeedback, null>
  ): void {
    const feedbackRef = kind === 'FIREBASE_AUTHENTICATION'
      ? this.configurationAuthenticationFeedbackRef
      : this.configurationMessagingFeedbackRef;
    feedbackRef.set(state);
    const timer = setTimeout(() => {
      feedbackRef.set(null);
      if (kind === 'FIREBASE_AUTHENTICATION') {
        this.configurationAuthenticationFeedbackTimer = null;
      } else {
        this.configurationMessagingFeedbackTimer = null;
      }
    }, 1000);
    if (kind === 'FIREBASE_AUTHENTICATION') {
      this.configurationAuthenticationFeedbackTimer = timer;
    } else {
      this.configurationMessagingFeedbackTimer = timer;
    }
  }

  private clearConfigurationTestFeedback(
    kind?: OperatorConfigurationTestKind
  ): void {
    if (!kind || kind === 'FIREBASE_AUTHENTICATION') {
      if (this.configurationAuthenticationFeedbackTimer) {
        clearTimeout(this.configurationAuthenticationFeedbackTimer);
        this.configurationAuthenticationFeedbackTimer = null;
      }
      this.configurationAuthenticationFeedbackRef.set(null);
    }
    if (!kind || kind === 'FIREBASE_MESSAGING') {
      if (this.configurationMessagingFeedbackTimer) {
        clearTimeout(this.configurationMessagingFeedbackTimer);
        this.configurationMessagingFeedbackTimer = null;
      }
      this.configurationMessagingFeedbackRef.set(null);
    }
  }
}
