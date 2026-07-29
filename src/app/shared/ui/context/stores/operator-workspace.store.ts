import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { FirebaseAppService } from '../../../core/base/services/firebase-app.service';
import {
  FirebaseMessagingService,
  type FirebaseMessagingReadinessLease
} from '../../../core/base/services/firebase-messaging.service';
import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import { OperatorConfigurationMapper } from '../../../core/base/mappers/operator-configuration.mapper';
import type { ListQuery } from '../../../core/contracts/list.interface';
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
  OperatorRevenueDto,
  OperatorRevenueReportDto,
  OperatorRevenueReportFilters,
  OperatorRevenueReportPageDto,
  OperatorRevenueSyncDto
} from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import { UserProfileStore } from './user-profile.store';

export type OperatorWorkspaceBusyAction =
  | 'load-workspace'
  | 'load-claim'
  | 'claim-share'
  | 'issue-grouping-token'
  | 'link-operator-group'
  | 'load-update'
  | 'apply-update'
  | 'load-configuration'
  | 'load-revenue'
  | 'synchronize-revenue'
  | 'requeue-revenue-report'
  | 'save-branding'
  | 'save-admin-emails'
  | 'save-social-links'
  | 'register-payment'
  | 'register-firebase'
  | 'activate-firebase'
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
  private readonly firebaseAppService = inject(FirebaseAppService);
  private readonly firebaseMessagingService = inject(FirebaseMessagingService);
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
  private readonly configurationAdminEmailsInputRef = signal('');
  private readonly configurationAuthenticationTestRef =
    signal<OperatorConfigurationTestResultDto | null>(null);
  private readonly configurationMessagingTestRef =
    signal<OperatorConfigurationTestResultDto | null>(null);
  private readonly configurationMessagingDestinationTokenRef = signal('');
  private readonly configurationAuthenticationFeedbackRef =
    signal<OperatorConfigurationTestFeedback>(null);
  private readonly configurationMessagingFeedbackRef =
    signal<OperatorConfigurationTestFeedback>(null);
  private readonly revenueRef = signal<OperatorRevenueDto | null>(null);
  private readonly revenueSyncRef = signal<OperatorRevenueSyncDto | null>(null);
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
  readonly configurationAdminEmailsInput =
    this.configurationAdminEmailsInputRef.asReadonly();
  readonly configurationAuthenticationTest =
    this.configurationAuthenticationTestRef.asReadonly();
  readonly configurationMessagingTest =
    this.configurationMessagingTestRef.asReadonly();
  readonly configurationMessagingDestinationToken =
    this.configurationMessagingDestinationTokenRef.asReadonly();
  readonly configurationAuthenticationFeedback =
    this.configurationAuthenticationFeedbackRef.asReadonly();
  readonly configurationMessagingFeedback =
    this.configurationMessagingFeedbackRef.asReadonly();
  readonly revenue = this.revenueRef.asReadonly();
  readonly revenueSync = this.revenueSyncRef.asReadonly();
  readonly community = this.communityRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly notice = this.noticeRef.asReadonly();
  readonly feedbackAction = this.feedbackActionRef.asReadonly();
  readonly claimCompanyReady = computed(() => {
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
  readonly claimClientCodeReady = computed(
    () => Boolean(this.groupTokenInputRef().trim())
  );
  readonly claimVerificationReady = computed(() => this.claimCompanyReady());
  readonly configurationUploadOwnerId = computed(() => {
    const session = this.sessionService.currentSession();
    return this.userProfileStore.activeUserProfile()?.id?.trim()
      || (session?.kind === 'demo' ? session.userId.trim() : '')
      || 'operator-branding';
  });
  readonly configurationFirebaseDirty = computed(() => {
    const configuration = this.configurationRef();
    const draft = this.configurationDraftRef();
    if (!configuration || !draft || configuration.capability !== 'AVAILABLE') {
      return false;
    }
    return (
      draft.firebase.projectId.trim() !== configuration.firebase.projectId
      || draft.firebase.apiKey.trim()
        !== configuration.firebase.publicConfiguration.apiKey
      || draft.firebase.authDomain.trim()
        !== configuration.firebase.publicConfiguration.authDomain
      || draft.firebase.storageBucket.trim()
        !== configuration.firebase.publicConfiguration.storageBucket
      || draft.firebase.messagingSenderId.trim()
        !== configuration.firebase.publicConfiguration.messagingSenderId
      || draft.firebase.appId.trim()
        !== configuration.firebase.publicConfiguration.appId
      || draft.firebase.measurementId.trim()
        !== (configuration.firebase.publicConfiguration.measurementId ?? '')
      || draft.firebase.vapidKey.trim()
        !== (configuration.firebase.publicConfiguration.vapidKey ?? '')
      || Boolean(draft.firebase.authenticationCredential.trim())
      || Boolean(draft.firebase.messagingCredential.trim())
    );
  });
  readonly configurationDirty = computed(() => {
    const configuration = this.configurationRef();
    const draft = this.configurationDraftRef();
    if (!configuration || !draft || configuration.capability !== 'AVAILABLE') {
      return false;
    }
    return (
      draft.branding.productName.trim() !== configuration.branding.productName
      || draft.branding.logoUrl.trim() !== configuration.branding.logoUrl
      || draft.branding.logoCharacterIndex
        !== configuration.branding.logoCharacterIndex
      || draft.branding.themePreset !== configuration.branding.themePreset
      || !OperatorConfigurationMapper.adminEmailsEqual(
        draft.adminEmails,
        configuration.adminEmails
      )
      || !OperatorConfigurationMapper.socialLinksEqual(
        draft.socialLinks,
        configuration.socialLinks
      )
      || (draft.payment.providerId ?? '') !== (configuration.payment.providerId ?? '')
      || Boolean(draft.payment.credential.trim())
      || this.configurationFirebaseDirty()
    );
  });
  readonly configurationBrandingReady = computed(() => {
    const draft = this.configurationDraftRef();
    if (!draft?.branding.productName.trim()) {
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
  readonly configurationAdminEmailsValidationKey = computed(() =>
    OperatorConfigurationMapper.adminEmailValidationKey(
      this.configurationAdminEmailsInputRef()
    )
  );
  readonly configurationAdminEmailsReady = computed(
    () => this.configurationAdminEmailsValidationKey() === null
  );
  readonly configurationSocialLinksValidationKey = computed(() =>
    OperatorConfigurationMapper.socialLinksValidationKey(
      this.configurationDraftRef()?.socialLinks ?? []
    )
  );
  readonly configurationSocialLinksReady = computed(
    () => this.configurationSocialLinksValidationKey() === null
  );

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

  async loadInitialWorkspace(): Promise<void> {
    const settled = await this.run(
      'load-workspace',
      () => Promise.allSettled([
        this.service.loadClaimStatus(),
        this.service.loadDeploymentUpdate(),
        this.service.loadCommunityStatus()
      ])
    );
    if (!settled) {
      return;
    }
    const [claimResult, updateResult, communityResult] = settled;
    if (claimResult.status === 'fulfilled') {
      this.applyClaimOverview(claimResult.value);
    }
    if (updateResult.status === 'fulfilled') {
      this.deploymentUpdateRef.set(updateResult.value);
    }
    if (communityResult.status === 'fulfilled') {
      this.communityRef.set(communityResult.value);
    }
    const failure = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) {
      this.errorRef.set(this.messageFromError(failure.reason));
    }
  }

  async loadClaimStatus(
    force = false
  ): Promise<OperatorClaimStatusDto | null> {
    const cached = this.claimStatusRef();
    if (cached && !force) {
      return cached;
    }
    const overview = await this.run('load-claim', () => this.service.loadClaimStatus());
    if (overview) {
      this.applyClaimOverview(overview);
    }
    return overview?.status ?? null;
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
    if (!this.claimCompanyReady()) {
      this.feedbackActionRef.set('claim-share');
      this.errorRef.set('operator.claim.verification.error.required');
      return null;
    }
    const draft = structuredClone(this.claimDraftRef());
    const mutation = await this.run(
      'claim-share',
      () => this.service.claimShare(draft)
    );
    if (mutation) {
      const result = mutation.status;
      this.claimStatusRef.set(result);
      if (mutation.submission) {
        this.claimDraftRef.set(structuredClone(mutation.submission));
      }
      this.noticeRef.set(
        result.verificationStatus === 'PENDING_REVIEW'
          ? 'operator.claim.verification.submitted'
          : 'operator.claim.completed'
      );
      this.leaderboard.applyMutation(mutation);
      return result;
    }
    return null;
  }

  async linkOperatorGroup(): Promise<OperatorClaimStatusDto | null> {
    const clientToken = this.groupTokenInputRef().trim();
    if (!this.claimClientCodeReady()) {
      this.errorRef.set('operator.claim.client.code.required');
      return null;
    }
    const mutation = await this.run(
      'link-operator-group',
      () => this.service.linkOperatorGroup(clientToken)
    );
    if (mutation) {
      const result = mutation.status;
      this.claimStatusRef.set(result);
      if (mutation.submission) {
        this.claimDraftRef.set(structuredClone(mutation.submission));
      }
      this.groupTokenInputRef.set('');
      this.noticeRef.set('operator.claim.client.code.submitted');
      this.leaderboard.applyMutation(mutation);
      return result;
    }
    return null;
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
      this.configurationAdminEmailsInputRef.set(
        OperatorConfigurationMapper.adminEmailInput(result.adminEmails)
      );
      this.deploymentConfiguration.applyBranding(result.branding);
      this.deploymentConfiguration.applySocialLinks(result.socialLinks);
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

  async synchronizeRevenue(): Promise<OperatorRevenueSyncDto | null> {
    const result = await this.run(
      'synchronize-revenue',
      () => this.service.synchronizeRevenue()
    );
    if (result) {
      this.revenueSyncRef.set(result);
    }
    return result;
  }

  revenueReportPage(
    query: ListQuery<OperatorRevenueReportFilters>,
    signal?: AbortSignal
  ): Promise<OperatorRevenueReportPageDto> {
    return this.service.revenueReportPage(query, signal);
  }

  async requeueRevenueReport(
    reportId: string
  ): Promise<OperatorRevenueReportDto | null> {
    const result = await this.run(
      'requeue-revenue-report',
      () => this.service.requeueRevenueReport(reportId)
    );
    if (!result) {
      return null;
    }
    if (result.status === 'PENDING') {
      this.revenueSyncRef.update(current => {
        if (!current) {
          return current;
        }
        const blocked = Math.max(0, current.blocked - 1);
        return {
          ...current,
          state: blocked > 0 ? 'BLOCKED' : 'PENDING',
          code: blocked > 0
            ? current.code
            : 'REVENUE_DELIVERY_PENDING',
          message: blocked > 0
            ? current.message
            : 'operator.revenue.delivery.requeued.pending',
          pending: current.pending + 1,
          blocked,
          synchronizedAtIso: current.synchronizedAtIso
        };
      });
    }
    this.noticeRef.set('operator.revenue.delivery.requeued');
    return result;
  }

  async saveConfiguration(
    action:
      | 'save-branding'
      | 'save-admin-emails'
      | 'save-social-links'
      | 'register-payment'
      | 'register-firebase',
    noticeKey = 'operator.configuration.saved'
  ): Promise<OperatorConfigurationDto | null> {
    const configuration = this.configurationRef();
    const draft = this.configurationDraftRef();
    const firebaseChanged = this.configurationFirebaseDirty();
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
    const adminEmailValidationKey =
      this.configurationAdminEmailsValidationKey();
    if (adminEmailValidationKey) {
      this.feedbackActionRef.set(action);
      this.errorRef.set(adminEmailValidationKey);
      return null;
    }
    const socialLinkValidationKey =
      this.configurationSocialLinksValidationKey();
    if (socialLinkValidationKey) {
      this.feedbackActionRef.set(action);
      this.errorRef.set(socialLinkValidationKey);
      return null;
    }
    const result = await this.run(
      action,
      () => this.service.saveConfiguration({
        ...structuredClone(draft),
        socialLinks: OperatorConfigurationMapper.socialLinks(
          draft.socialLinks
        )
      })
    );
    if (result) {
      this.configurationRef.set(result);
      this.configurationDraftRef.set(this.configurationDraftFrom(result));
      this.configurationAdminEmailsInputRef.set(
        OperatorConfigurationMapper.adminEmailInput(result.adminEmails)
      );
      this.configurationAuthenticationTestRef.set(null);
      this.configurationMessagingTestRef.set(null);
      this.clearConfigurationTestFeedback();
      this.deploymentConfiguration.applyBranding(result.branding);
      this.deploymentConfiguration.applySocialLinks(result.socialLinks);
      if (firebaseChanged) {
        await this.firebaseAppService.refreshFirebaseApp();
      }
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
    const destinationToken =
      this.configurationMessagingDestinationTokenRef().trim();
    let readinessLease: FirebaseMessagingReadinessLease | null = null;
    if (kind === 'FIREBASE_MESSAGING') {
      const publicConfiguration =
        this.configurationRef()?.firebase.publicConfiguration;
      if (publicConfiguration?.vapidKey?.trim()) {
        try {
          readinessLease =
            await this.firebaseMessagingService.createBrowserReadinessLease({
              revision: publicConfiguration.revision,
              apiKey: publicConfiguration.apiKey,
              authDomain: publicConfiguration.authDomain,
              projectId: publicConfiguration.projectId,
              storageBucket: publicConfiguration.storageBucket,
              messagingSenderId: publicConfiguration.messagingSenderId,
              appId: publicConfiguration.appId,
              ...(publicConfiguration.measurementId
                ? { measurementId: publicConfiguration.measurementId }
                : {}),
              vapidKey: publicConfiguration.vapidKey
            });
        } catch {
          // The backend receives no proof and clears stale readiness state.
        }
      }
    }
    const firebaseWasActive =
      this.configurationRef()?.firebase.active ?? false;
    const result = await this.run(
      kind === 'FIREBASE_AUTHENTICATION' ? 'test-authentication' : 'test-messaging',
      async () => {
        try {
          return await this.service.testConfiguration({
            kind,
            ...(kind === 'FIREBASE_MESSAGING' && destinationToken
              ? { destinationToken }
              : {}),
            ...(kind === 'FIREBASE_MESSAGING' && readinessLease
              ? {
                  browserReadinessToken: readinessLease.proof.token,
                  browserConfigurationRevision:
                    readinessLease.proof.configurationRevision,
                  browserAppId: readinessLease.proof.appId
                }
              : {})
          });
        } finally {
          await readinessLease?.release();
        }
      }
    );
    if (result) {
      const authoritativeFirebase = result.firebase;
      if (authoritativeFirebase) {
        this.configurationRef.update(current => current
          ? {
              ...current,
              firebase: structuredClone(authoritativeFirebase)
            }
          : current
        );
        if (firebaseWasActive && !authoritativeFirebase.active) {
          await this.firebaseAppService.refreshFirebaseApp();
        }
      }
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
        testedAt: new Date().toISOString(),
        firebase: null
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

  async activateFirebase(): Promise<OperatorConfigurationDto | null> {
    const result = await this.run(
      'activate-firebase',
      () => this.service.activateFirebase()
    );
    if (result) {
      this.configurationRef.set(result);
      this.configurationDraftRef.set(this.configurationDraftFrom(result));
      await this.firebaseAppService.refreshFirebaseApp();
      this.noticeRef.set('operator.configuration.firebase.activated');
    }
    return result;
  }

  async loadCommunityStatus(
    force = false
  ): Promise<OperatorCommunityStatusDto | null> {
    const cached = this.communityRef();
    if (cached && !force) {
      return cached;
    }
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
    this.configurationMessagingDestinationTokenRef.set('');
    this.revenueRef.set(null);
    this.revenueSyncRef.set(null);
    this.clearConfigurationTestFeedback();
  }

  clearConfigurationCredentialDrafts(): void {
    this.configurationDraftRef.update(current => current
      ? {
          ...current,
          firebase: {
            ...current.firebase,
            authenticationCredential: '',
            messagingCredential: ''
          }
        }
      : current
    );
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

  applyRegistryDeactivation(): void {
    this.claimStatusRef.update(current => current
      ? {
          ...current,
          claimed: false,
          claimedAt: null,
          claimantUserId: null,
          claimantName: null,
          claimantAvatarUrl: null,
          operatorGroupId: null,
          activeLinkId: null,
          sharePercent: 0,
          shareNumerator: '0',
          shareDenominator: '1',
          verificationStatus:
            current.verificationStatus === 'NOT_SUBMITTED'
              ? 'NOT_SUBMITTED'
              : 'WITHDRAWN',
          legalName: null
        }
      : current
    );
    this.claimDraftRef.set(this.emptyClaimDraft());
    this.groupingTokenRef.set(null);
    this.groupTokenInputRef.set('');
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

  setConfigurationAdminEmailsInput(value: string): void {
    const input = `${value ?? ''}`.slice(0, 8192);
    this.configurationAdminEmailsInputRef.set(input);
    this.configurationDraftRef.update(current => current
      ? {
          ...current,
          adminEmails: OperatorConfigurationMapper.adminEmails(input)
        }
      : current
    );
  }

  addConfigurationSocialLink(): void {
    this.configurationDraftRef.update(current => {
      if (
        !current
        || current.socialLinks.length
          >= OperatorConfigurationMapper.SOCIAL_LINK_MAX_COUNT
      ) {
        return current;
      }
      return {
        ...current,
        socialLinks: [
          ...current.socialLinks,
          {
            provider: '',
            label: '',
            url: '',
            icon: null,
            handle: null
          }
        ]
      };
    });
  }

  setConfigurationSocialLink(
    index: number,
    patch: Partial<OperatorConfigurationSaveRequestDto['socialLinks'][number]>
  ): void {
    this.configurationDraftRef.update(current => {
      if (!current || index < 0 || index >= current.socialLinks.length) {
        return current;
      }
      return {
        ...current,
        socialLinks: current.socialLinks.map((link, linkIndex) =>
          linkIndex === index
            ? {
                ...link,
                ...patch
              }
            : link
        )
      };
    });
  }

  removeConfigurationSocialLink(index: number): void {
    this.configurationDraftRef.update(current => {
      if (!current || index < 0 || index >= current.socialLinks.length) {
        return current;
      }
      return {
        ...current,
        socialLinks: current.socialLinks.filter(
          (_link, linkIndex) => linkIndex !== index
        )
      };
    });
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

  setConfigurationMessagingDestinationToken(value: string): void {
    this.configurationMessagingDestinationTokenRef.set(
      `${value ?? ''}`.slice(0, 4096)
    );
    this.configurationMessagingTestRef.set(null);
    this.clearConfigurationTestFeedback('FIREBASE_MESSAGING');
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
    this.configurationAdminEmailsInputRef.set('');
    this.configurationAuthenticationTestRef.set(null);
    this.configurationMessagingTestRef.set(null);
    this.configurationMessagingDestinationTokenRef.set('');
    this.revenueSyncRef.set(null);
    this.communityRef.set(null);
    this.busyActionRef.set(null);
    this.clearFeedback();
  }

  private applyClaimOverview(
    overview: Awaited<ReturnType<OperatorRegistryService['loadClaimStatus']>>
  ): void {
    this.claimStatusRef.set(overview.status);
    if (overview.submission) {
      this.claimDraftRef.set(structuredClone(overview.submission));
    } else {
      this.seedClaimContact();
    }
  }

  private sessionKey(session: AppSession | null): string {
    if (session?.kind === 'demo') {
      return `demo:${session.userId.trim()}`;
    }
    if (session?.kind === 'firebase') {
      return `firebase:${session.profile.id.trim()}`;
    }
    if (session?.kind === 'operator-bootstrap') {
      return `operator-bootstrap:${session.email.trim()}`;
    }
    return 'none';
  }

  private configurationDraftFrom(
    configuration: OperatorConfigurationDto
  ): OperatorConfigurationSaveRequestDto {
    return {
      adminEmails: OperatorConfigurationMapper.adminEmails(
        configuration.adminEmails
      ),
      socialLinks: OperatorConfigurationMapper.socialLinks(
        configuration.socialLinks
      ),
      branding: {
        productName: configuration.branding.productName,
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
        apiKey: configuration.firebase.publicConfiguration.apiKey,
        authDomain: configuration.firebase.publicConfiguration.authDomain,
        storageBucket:
          configuration.firebase.publicConfiguration.storageBucket,
        messagingSenderId:
          configuration.firebase.publicConfiguration.messagingSenderId,
        appId: configuration.firebase.publicConfiguration.appId,
        measurementId:
          configuration.firebase.publicConfiguration.measurementId ?? '',
        vapidKey: configuration.firebase.publicConfiguration.vapidKey ?? '',
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
    if (
      !profile
      && session?.kind !== 'firebase'
      && session?.kind !== 'operator-bootstrap'
    ) {
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
        || (session?.kind === 'firebase'
          ? session.profile.email.trim()
          : session?.kind === 'operator-bootstrap'
            ? session.email.trim()
            : '')
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
        (url.protocol === 'https:' || url.protocol === 'http:')
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
