import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type {
  OperatorGroupingTokenDto,
  OperatorClaimStatusDto,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestKind,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto
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
  | 'save-branding'
  | 'register-payment'
  | 'register-firebase'
  | 'test-authentication'
  | 'test-messaging'
  | 'load-community'
  | 'set-community'
  | null;

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
  private readonly groupingTokenRef = signal<OperatorGroupingTokenDto | null>(null);
  private readonly groupTokenInputRef = signal('');
  private readonly deploymentUpdateRef = signal<OperatorDeploymentUpdateDto | null>(null);
  private readonly configurationRef = signal<OperatorConfigurationDto | null>(null);
  private readonly configurationDraftRef =
    signal<OperatorConfigurationSaveRequestDto | null>(null);
  private readonly configurationTestRef = signal<OperatorConfigurationTestResultDto | null>(null);
  private readonly communityRef = signal<OperatorCommunityStatusDto | null>(null);
  private readonly busyActionRef = signal<OperatorWorkspaceBusyAction>(null);
  private readonly errorRef = signal('');
  private readonly noticeRef = signal('');
  private requestGeneration = 0;
  private contextKey = this.sessionKey(this.sessionService.currentSession());

  readonly claimStatus = this.claimStatusRef.asReadonly();
  readonly groupingToken = this.groupingTokenRef.asReadonly();
  readonly groupTokenInput = this.groupTokenInputRef.asReadonly();
  readonly deploymentUpdate = this.deploymentUpdateRef.asReadonly();
  readonly configuration = this.configurationRef.asReadonly();
  readonly configurationDraft = this.configurationDraftRef.asReadonly();
  readonly configurationTest = this.configurationTestRef.asReadonly();
  readonly community = this.communityRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly notice = this.noticeRef.asReadonly();
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
      || draft.branding.themePreset !== configuration.branding.themePreset
      || (draft.payment.providerId ?? '') !== (configuration.payment.providerId ?? '')
      || Boolean(draft.payment.credential.trim())
      || draft.firebase.projectId.trim() !== configuration.firebase.projectId
      || Boolean(draft.firebase.authenticationCredential.trim())
      || Boolean(draft.firebase.messagingCredential.trim())
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
    const profile = this.userProfileStore.activeUserProfile();
    const operatorName = profile?.name?.trim() ?? '';
    if (!operatorName) {
      this.errorRef.set('operator.claim.error.profile.required');
      return null;
    }
    const result = await this.run(
      'claim-share',
      () => this.service.claimShare({
        operatorName,
        operatorAvatarUrl: this.firstSafeHttpsUrl(profile?.images)
      })
    );
    if (result) {
      this.claimStatusRef.set(result);
      this.noticeRef.set('operator.claim.completed');
      this.leaderboard.invalidate();
    }
    return result;
  }

  async linkOperatorGroup(): Promise<OperatorClaimStatusDto | null> {
    const clientToken = this.groupTokenInputRef().trim();
    if (!clientToken) {
      this.errorRef.set('operator.group.token.required');
      return null;
    }
    const result = await this.run(
      'link-operator-group',
      () => this.service.linkOperatorGroup(clientToken)
    );
    if (result) {
      this.claimStatusRef.set(result);
      this.groupTokenInputRef.set('');
      this.noticeRef.set('operator.group.linked');
      this.leaderboard.invalidate();
    }
    return result;
  }

  async loadDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto | null> {
    const result = await this.run(
      'load-update',
      () => this.service.loadDeploymentUpdate()
    );
    if (result) {
      this.deploymentUpdateRef.set(result);
    }
    return result;
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
      this.configurationTestRef.set(null);
      this.deploymentConfiguration.applyBranding(result.branding);
      this.noticeRef.set(noticeKey);
    }
    return result;
  }

  async testConfiguration(
    kind: OperatorConfigurationTestKind
  ): Promise<OperatorConfigurationTestResultDto | null> {
    const result = await this.run(
      kind === 'FIREBASE_AUTHENTICATION' ? 'test-authentication' : 'test-messaging',
      () => this.service.testConfiguration({ kind })
    );
    if (result) {
      this.configurationTestRef.set(result);
      this.noticeRef.set(result.success
        ? 'operator.configuration.test.success'
        : 'operator.configuration.test.failed');
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
    this.configurationTestRef.set(null);
  }

  setGroupTokenInput(value: string): void {
    this.groupTokenInputRef.set(`${value ?? ''}`);
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
    this.groupingTokenRef.set(null);
    this.groupTokenInputRef.set('');
    this.deploymentUpdateRef.set(null);
    this.configurationRef.set(null);
    this.configurationDraftRef.set(null);
    this.configurationTestRef.set(null);
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

  private firstSafeHttpsUrl(values: readonly string[] | null | undefined): string | null {
    for (const value of values ?? []) {
      try {
        const url = new URL(`${value ?? ''}`.trim());
        if (url.protocol === 'https:' && !url.username && !url.password) {
          return url.toString();
        }
      } catch {
        // Continue to the next profile image.
      }
    }
    return null;
  }
}
