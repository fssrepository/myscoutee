import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { FirebaseAppService } from '../../../core/base/services/firebase-app.service';
import { FirebaseMessagingService } from '../../../core/base/services/firebase-messaging.service';
import { SessionService } from '../../../core/base/services/session.service';
import type {
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto,
  OperatorRevenueDto
} from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import { OperatorWorkspaceStore } from './operator-workspace.store';
import { UserProfileStore } from './user-profile.store';

describe('OperatorWorkspaceStore', () => {
  const claimShare = vi.fn();
  const linkOperatorGroup = vi.fn();
  const loadClaimStatus = vi.fn();
  const loadDeploymentUpdate = vi.fn();
  const loadRevenue = vi.fn();
  const loadConfiguration = vi.fn();
  const loadCommunityStatus = vi.fn();
  const saveConfiguration = vi.fn();
  const synchronizeRevenue = vi.fn();
  const revenueReportPage = vi.fn();
  const requeueRevenueReport = vi.fn();
  const settlementPage = vi.fn();
  const testConfiguration = vi.fn();
  const refreshFirebaseApp = vi.fn();
  const applyPrivacyContact = vi.fn();
  const createBrowserReadinessLease = vi.fn();
  const releaseBrowserReadinessLease = vi.fn();
  const applyMutation = vi.fn();
  const invalidate = vi.fn();
  const session = signal({
    kind: 'firebase' as const,
    profile: {
      id: 'operator-real',
      name: 'Operator Real',
      email: 'operator@example.test',
      initials: 'OR'
    }
  });
  const activeUserProfile = signal({
    id: 'operator-real',
    name: '  Verified Operator  ',
    images: [
      'http://cdn.example.test/insecure.webp',
      'https://user:secret@cdn.example.test/credentials.webp',
      'not a URL',
      'https://cdn.example.test/operator.webp',
      'https://cdn.example.test/later.webp'
    ]
  });

  beforeEach(() => {
    claimShare.mockReset();
    linkOperatorGroup.mockReset();
    loadClaimStatus.mockReset();
    loadDeploymentUpdate.mockReset();
    loadRevenue.mockReset();
    loadConfiguration.mockReset();
    loadCommunityStatus.mockReset();
    saveConfiguration.mockReset();
    synchronizeRevenue.mockReset();
    revenueReportPage.mockReset();
    requeueRevenueReport.mockReset();
    settlementPage.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
      context: {
        generatedAtIso: '2026-07-28T18:00:00.000Z'
      }
    });
    testConfiguration.mockReset();
    refreshFirebaseApp.mockReset();
    refreshFirebaseApp.mockResolvedValue(null);
    applyPrivacyContact.mockReset();
    createBrowserReadinessLease.mockReset();
    releaseBrowserReadinessLease.mockReset();
    releaseBrowserReadinessLease.mockResolvedValue(undefined);
    applyMutation.mockReset();
    invalidate.mockReset();
    activeUserProfile.set({
      id: 'operator-real',
      name: '  Verified Operator  ',
      images: [
        'http://cdn.example.test/insecure.webp',
        'https://user:secret@cdn.example.test/credentials.webp',
        'not a URL',
        'https://cdn.example.test/operator.webp',
        'https://cdn.example.test/later.webp'
      ]
    });
    TestBed.configureTestingModule({
      providers: [
        OperatorWorkspaceStore,
        {
          provide: OperatorRegistryService,
          useValue: {
            claimShare,
            linkOperatorGroup,
            loadClaimStatus,
            loadDeploymentUpdate,
            loadConfiguration,
            loadCommunityStatus,
            saveConfiguration,
            loadRevenue,
            synchronizeRevenue,
            revenueReportPage,
            requeueRevenueReport,
            settlementPage,
            testConfiguration
          }
        },
        {
          provide: DeploymentConfigurationService,
          useValue: {
            applyBranding: vi.fn(),
            applySocialLinks: vi.fn(),
            applyPrivacyContact
          }
        },
        {
          provide: FirebaseAppService,
          useValue: { refreshFirebaseApp }
        },
        {
          provide: FirebaseMessagingService,
          useValue: { createBrowserReadinessLease }
        },
        {
          provide: SessionService,
          useValue: {
            session,
            currentSession: () => session()
          }
        },
        {
          provide: OperatorLeaderboardStore,
          useValue: { applyMutation, invalidate }
        },
        {
          provide: UserProfileStore,
          useValue: { activeUserProfile }
        }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('submits the explicit structured company verification claim', async () => {
    loadClaimStatus.mockResolvedValue({
      status: unclaimedStatus(),
      submission: null
    });
    const claimed = claimStatus();
    const acceptedSubmission = claimSubmission();
    const mutation = {
      status: claimed,
      submission: acceptedSubmission,
      leaderboardEntry: null,
      leaderboardUpserts: [],
      removedLeaderboardEntryIds: ['dep_operator_real'],
      leaderboardTotalDelta: -1
    };
    claimShare.mockResolvedValue(mutation);
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadClaimStatus();
    store.setClaimDraft({
      legalName: ' Example Operator s.r.o. ',
      registrationNumber: ' 51 234 567 ',
      jurisdiction: ' Slovakia ',
      registeredAddress: ' Main Street 1, Bratislava ',
      website: ' https://operator.example.test ',
      verificationContactName: ' Authorized Contact ',
      verificationContactRole: ' Managing director ',
      verificationContactEmail: ' CONTACT@EXAMPLE.TEST ',
      authorityAttested: true
    });

    const result = await store.claimShare();

    expect(result).toEqual(claimed);
    expect(claimShare).toHaveBeenCalledWith({
      legalName: ' Example Operator s.r.o. ',
      registrationNumber: ' 51 234 567 ',
      jurisdiction: ' Slovakia ',
      registeredAddress: ' Main Street 1, Bratislava ',
      website: ' https://operator.example.test ',
      verificationContactName: ' Authorized Contact ',
      verificationContactRole: ' Managing director ',
      verificationContactEmail: ' CONTACT@EXAMPLE.TEST ',
      authorityAttested: true
    });
    expect(store.claimStatus()).toEqual(claimed);
    expect(store.claimDraft()).toEqual(acceptedSubmission);
    expect(store.notice()).toBe('operator.claim.verification.submitted');
    expect(applyMutation).toHaveBeenCalledWith(mutation);
  });

  it('hydrates the exact submitted company data when reopening a pending claim', async () => {
    const submission: OperatorClaimRequestDto = {
      ...claimSubmission(),
      legalName: 'Exact Accepted Operator s.r.o.',
      registrationNumber: 'SK-51 234 567'
    };
    loadClaimStatus.mockResolvedValue({
      status: claimStatus(),
      submission
    });
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.loadClaimStatus();

    expect(store.claimDraft()).toEqual(submission);
    expect(store.claimStatus()?.verificationStatus).toBe('PENDING_REVIEW');
  });

  it('applies the targeted leaderboard mutation returned by client-code linking', async () => {
    const linkedStatus: OperatorClaimStatusDto = {
      ...claimStatus(),
      operatorGroupId: 'operator-group-linked'
    };
    const acceptedSubmission = claimSubmission();
    const linkedEntry = {
      id: 'operator-group-linked',
      nodeId: null,
      label: 'Linked Operator',
      group: 'CLAIMED' as const,
      verifiedWeight: 17,
      sharePercent: 4.25,
      claimed: true,
      eligibilityStatus: 'INACTIVE' as const,
      operatorGroupId: 'operator-group-linked',
      deploymentCount: 2,
      claimVerificationStatus: 'PENDING_REVIEW' as const
    };
    const mutation = {
      status: linkedStatus,
      submission: acceptedSubmission,
      leaderboardEntry: linkedEntry,
      leaderboardUpserts: [linkedEntry],
      removedLeaderboardEntryIds: ['dep_operator_real'],
      leaderboardTotalDelta: 0
    };
    linkOperatorGroup.mockResolvedValue(mutation);
    const store = TestBed.inject(OperatorWorkspaceStore);
    store.setGroupTokenInput(' temporary-client-code ');

    const result = await store.linkOperatorGroup();

    expect(result).toEqual(linkedStatus);
    expect(linkOperatorGroup).toHaveBeenCalledWith('temporary-client-code');
    expect(store.claimStatus()).toEqual(linkedStatus);
    expect(store.claimDraft()).toEqual(acceptedSubmission);
    expect(store.groupTokenInput()).toBe('');
    expect(store.notice()).toBe('operator.claim.client.code.submitted');
    expect(applyMutation).toHaveBeenCalledWith(mutation);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not submit an incomplete company verification claim', async () => {
    loadClaimStatus.mockResolvedValue({
      status: unclaimedStatus(),
      submission: null
    });
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadClaimStatus();
    store.setClaimDraft({
      legalName: 'Example Operator s.r.o.',
      authorityAttested: true
    });

    const result = await store.claimShare();

    expect(result).toBeNull();
    expect(claimShare).not.toHaveBeenCalled();
    expect(store.error()).toBe('operator.claim.verification.error.required');
  });

  it('uses the workspace update snapshot until an explicit refresh', async () => {
    const initial = deploymentUpdate('1.1.0');
    const refreshed = deploymentUpdate('1.2.0');
    loadDeploymentUpdate
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed);
    const store = TestBed.inject(OperatorWorkspaceStore);

    expect(await store.loadDeploymentUpdate()).toEqual(initial);
    expect(await store.loadDeploymentUpdate()).toEqual(initial);
    expect(loadDeploymentUpdate).toHaveBeenCalledTimes(1);

    expect(await store.refreshDeploymentUpdate()).toEqual(refreshed);
    expect(store.deploymentUpdate()).toEqual(refreshed);
    expect(loadDeploymentUpdate).toHaveBeenCalledTimes(2);
  });

  it('hydrates claim, update, and community state together and reuses it', async () => {
    const update = deploymentUpdate('1.1.0');
    const community = operatorCommunity();
    loadClaimStatus.mockResolvedValue({
      status: claimStatus(),
      submission: claimSubmission()
    });
    loadDeploymentUpdate.mockResolvedValue(update);
    loadCommunityStatus.mockResolvedValue(community);
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.loadInitialWorkspace();

    expect(store.claimStatus()?.verificationStatus).toBe('PENDING_REVIEW');
    expect(store.claimDraft()).toEqual(claimSubmission());
    expect(store.deploymentUpdate()).toEqual(update);
    expect(store.community()).toEqual(community);
    expect(loadClaimStatus).toHaveBeenCalledTimes(1);
    expect(loadDeploymentUpdate).toHaveBeenCalledTimes(1);
    expect(loadCommunityStatus).toHaveBeenCalledTimes(1);

    await store.loadClaimStatus();
    await store.loadDeploymentUpdate();
    await store.loadCommunityStatus();

    expect(loadClaimStatus).toHaveBeenCalledTimes(1);
    expect(loadDeploymentUpdate).toHaveBeenCalledTimes(1);
    expect(loadCommunityStatus).toHaveBeenCalledTimes(1);
  });

  it('loads and caches revenue only when its operator action is opened', async () => {
    const revenue = operatorRevenue();
    loadRevenue.mockResolvedValue(revenue);
    const store = TestBed.inject(OperatorWorkspaceStore);

    expect(store.revenue()).toBeNull();
    expect(await store.loadRevenue()).toEqual(revenue);
    expect(await store.loadRevenue()).toEqual(revenue);

    expect(store.revenue()).toEqual(revenue);
    expect(loadRevenue).toHaveBeenCalledTimes(1);
    expect(settlementPage).toHaveBeenCalledTimes(1);
    expect(store.revenueSettlementAvailable()).toBe(true);
    expect(await store.settlementPage({
      page: 0,
      pageSize: 6,
      filters: { includeSuperseded: false }
    })).toEqual(expect.objectContaining({
      items: [],
      nextCursor: null
    }));
    expect(settlementPage).toHaveBeenCalledTimes(1);
  });

  it('keeps local revenue visible when registry settlement history is unavailable', async () => {
    const revenue = operatorRevenue();
    loadRevenue.mockResolvedValue(revenue);
    settlementPage.mockRejectedValue(
      new Error('operator.registry.error.unregistered')
    );
    const store = TestBed.inject(OperatorWorkspaceStore);

    expect(await store.loadRevenue()).toEqual(revenue);

    expect(store.revenue()).toEqual(revenue);
    expect(store.revenueSettlementAvailable()).toBe(false);
    expect(store.error()).toBe('');
  });

  it('keeps the aggregate result from an explicit revenue synchronization', async () => {
    const synchronization = {
      state: 'PENDING' as const,
      code: 'REVENUE_DELIVERY_PENDING',
      message: 'Revenue reports are stored and will be retried.',
      materialized: 1,
      submitted: 1,
      accepted: 0,
      pending: 1,
      blocked: 0,
      synchronizedAtIso: '2026-07-28T18:31:00.000Z'
    };
    synchronizeRevenue.mockResolvedValue(synchronization);
    const store = TestBed.inject(OperatorWorkspaceStore);

    expect(store.revenueSync()).toBeNull();
    expect(await store.synchronizeRevenue()).toEqual(synchronization);

    expect(store.revenueSync()).toEqual(synchronization);
    expect(synchronizeRevenue).toHaveBeenCalledTimes(1);
  });

  it('requeues one blocked report and updates the aggregate delivery counters', async () => {
    synchronizeRevenue.mockResolvedValue({
      state: 'BLOCKED',
      code: 'REVENUE_OUTBOX_BLOCKED',
      message: 'A revenue report requires operator review.',
      materialized: 0,
      submitted: 0,
      accepted: 0,
      pending: 0,
      blocked: 1,
      synchronizedAtIso: '2026-07-28T18:31:00.000Z'
    });
    requeueRevenueReport.mockResolvedValue({
      id: '0123456789abcdef01234567',
      period: '2026-07-27',
      revision: 1,
      supersedesBatchId: null,
      rulesetVersion: 'net-captured-revenue-v1',
      commissionRateBasisPoints: 500,
      currencies: [],
      payloadHash: 'payload-hash',
      status: 'PENDING',
      attemptCount: 1,
      nextRetryAt: null,
      failureCode: 'INVALID_REVENUE_RECEIPT',
      failureMessage: 'Registry receipt was invalid.',
      failureRetryable: false,
      failedAt: '2026-07-28T18:30:00.000Z',
      acceptedBatchId: null,
      acceptedAt: null,
      createdAt: '2026-07-28T18:29:00.000Z',
      updatedAt: '2026-07-28T18:32:00.000Z'
    });
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.synchronizeRevenue();
    const result = await store.requeueRevenueReport(
      '0123456789abcdef01234567'
    );

    expect(result?.status).toBe('PENDING');
    expect(store.revenueSync()).toEqual(expect.objectContaining({
      state: 'PENDING',
      code: 'REVENUE_DELIVERY_PENDING',
      pending: 1,
      blocked: 0,
      message: 'operator.revenue.delivery.requeued.pending'
    }));
    expect(store.notice()).toBe('operator.revenue.delivery.requeued');
  });

  it('briefly exposes independent shared action feedback for Firebase tests', async () => {
    vi.useFakeTimers();
    testConfiguration.mockResolvedValue({
      kind: 'FIREBASE_AUTHENTICATION',
      success: true,
      message: 'operator.configuration.test.success',
      testedAt: '2026-07-28T18:00:00.000Z',
      firebase: null
    });
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.testConfiguration('FIREBASE_AUTHENTICATION');

    expect(store.configurationAuthenticationFeedback()).toBe('success');
    expect(store.configurationMessagingFeedback()).toBeNull();
    expect(store.configurationAuthenticationTest()?.success).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(store.configurationAuthenticationFeedback()).toBeNull();
  });

  it('drops an in-flight Firebase result after the configuration popup ends', async () => {
    let resolveTest!: (
      value: OperatorConfigurationTestResultDto
    ) => void;
    testConfiguration.mockImplementation(() =>
      new Promise<OperatorConfigurationTestResultDto>(resolve => {
        resolveTest = resolve;
      })
    );
    const store = TestBed.inject(OperatorWorkspaceStore);

    const pending = store.testConfiguration(
      'FIREBASE_AUTHENTICATION'
    );
    expect(store.busyAction()).toBe('test-authentication');

    store.clearConfigurationCredentialDrafts();
    resolveTest({
      kind: 'FIREBASE_AUTHENTICATION',
      success: true,
      message: 'operator.configuration.test.success',
      testedAt: '2026-07-28T18:00:00.000Z',
      firebase: null
    });

    await expect(pending).resolves.toBeNull();
    expect(store.busyAction()).toBeNull();
    expect(store.configurationAuthenticationTest()).toBeNull();
    expect(store.configurationAuthenticationFeedback()).toBeNull();
  });

  it('sends current browser readiness proof and releases its isolated token', async () => {
    const configured = operatorConfiguration();
    configured.firebase = {
      ...configured.firebase,
      projectId: 'community-project',
      messagingCredentialConfigured: true,
      publicConfiguration: {
        revision: 7,
        apiKey: 'browser-api-key',
        authDomain: 'community-project.firebaseapp.com',
        projectId: 'community-project',
        storageBucket: 'community-project.firebasestorage.app',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:operator',
        measurementId: null,
        vapidKey: 'public-vapid-key'
      }
    };
    loadConfiguration.mockResolvedValue(configured);
    createBrowserReadinessLease.mockResolvedValue({
      proof: {
        token: 'browser-generated-token',
        configurationRevision: 7,
        appId: '1:123456789:web:operator'
      },
      release: releaseBrowserReadinessLease
    });
    testConfiguration.mockResolvedValue({
      kind: 'FIREBASE_MESSAGING',
      success: true,
      message: 'Firebase messaging test succeeded.',
      testedAt: '2026-07-28T18:05:00.000Z',
      firebase: null
    });
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();

    store.setConfigurationMessagingDestinationToken(' registration-token ');
    await store.testConfiguration('FIREBASE_MESSAGING');

    expect(testConfiguration).toHaveBeenCalledWith({
      kind: 'FIREBASE_MESSAGING',
      destinationToken: 'registration-token',
      browserReadinessToken: 'browser-generated-token',
      browserConfigurationRevision: 7,
      browserAppId: '1:123456789:web:operator'
    });
    expect(releaseBrowserReadinessLease).toHaveBeenCalledOnce();
    expect(store.configurationMessagingTest()?.success).toBe(true);

    store.clearFeedback();

    expect(store.configurationMessagingDestinationToken()).toBe('');
  });

  it('fails closed through the backend when browser readiness cannot be created', async () => {
    const configured = operatorConfiguration();
    configured.firebase = {
      ...configured.firebase,
      projectId: 'community-project',
      messagingCredentialConfigured: true,
      publicConfiguration: {
        ...configured.firebase.publicConfiguration,
        revision: 8,
        projectId: 'community-project',
        appId: '1:123456789:web:operator',
        vapidKey: 'public-vapid-key'
      }
    };
    loadConfiguration.mockResolvedValue(configured);
    createBrowserReadinessLease.mockRejectedValue(
      new Error('operator.configuration.test.failed')
    );
    testConfiguration.mockResolvedValue({
      kind: 'FIREBASE_MESSAGING',
      success: false,
      message: 'operator.configuration.test.failed',
      testedAt: '2026-07-28T18:05:00.000Z',
      firebase: {
        ...configured.firebase,
        messagingTestedAt: null
      }
    });
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();

    await store.testConfiguration('FIREBASE_MESSAGING');

    expect(testConfiguration).toHaveBeenCalledWith({
      kind: 'FIREBASE_MESSAGING'
    });
    expect(store.configurationMessagingTest()?.success).toBe(false);
  });

  it('applies authoritative Firebase deactivation from a failed backend test', async () => {
    const active = operatorConfiguration();
    active.firebase = {
      ...active.firebase,
      active: true,
      activatedAt: '2026-07-28T17:00:00.000Z'
    };
    loadConfiguration.mockResolvedValue(active);
    testConfiguration.mockResolvedValue({
      kind: 'FIREBASE_AUTHENTICATION',
      success: false,
      message: 'Firebase authentication test failed.',
      testedAt: '2026-07-28T18:10:00.000Z',
      firebase: {
        ...active.firebase,
        active: false,
        readyToActivate: false,
        authenticationTestedAt: null,
        activatedAt: null
      }
    });
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();
    store.setConfigurationFirebase({
      apiKey: 'unsaved-browser-api-key'
    });

    await store.testConfiguration('FIREBASE_AUTHENTICATION');

    expect(store.configuration()?.firebase.active).toBe(false);
    expect(store.configuration()?.firebase.activatedAt).toBeNull();
    expect(store.configurationDraft()?.firebase.apiKey)
      .toBe('unsaved-browser-api-key');
    expect(refreshFirebaseApp).toHaveBeenCalledOnce();
  });

  it('clears every unsaved write-only credential draft', async () => {
    loadConfiguration.mockResolvedValue(operatorConfiguration());
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();
    store.setConfigurationPayment({
      providerId: 'stripe',
      credential: 'write-only-payment'
    });
    store.setConfigurationFirebase({
      apiKey: 'unsaved-browser-api-key',
      authDomain: 'unsaved.firebaseapp.com',
      authenticationCredential: 'write-only-authentication',
      messagingCredential: 'write-only-messaging'
    });

    store.clearConfigurationCredentialDrafts();

    expect(store.configurationDraft()?.payment).toEqual(
      expect.objectContaining({
        providerId: 'stripe',
        credential: ''
      })
    );
    expect(store.configurationDraft()?.firebase).toEqual(
      expect.objectContaining({
        apiKey: 'unsaved-browser-api-key',
        authDomain: 'unsaved.firebaseapp.com',
        authenticationCredential: '',
        messagingCredential: ''
      })
    );
  });

  it('requires provider routing and clears it when the provider is removed', async () => {
    loadConfiguration.mockResolvedValue(operatorConfiguration());
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();

    store.setConfigurationPayment({
      providerId: 'barion',
      publicBaseUrl: 'https://community.example.test',
      merchantAccount: 'not-an-email',
      credential: 'write-only-payment'
    });

    expect(store.configurationPaymentValidationKey())
      .toBe('operator.configuration.payment.merchant.account.invalid');
    expect(store.configurationPaymentReady()).toBe(false);

    store.setConfigurationPayment({
      merchantAccount: 'merchant@example.test'
    });

    expect(store.configurationPaymentValidationKey()).toBeNull();
    expect(store.configurationPaymentReady()).toBe(true);

    store.setConfigurationPayment({ providerId: null });

    expect(store.configurationDraft()?.payment).toEqual({
      providerId: null,
      publicBaseUrl: '',
      merchantAccount: '',
      credential: ''
    });
    expect(store.configurationPaymentReady()).toBe(false);
  });

  it('normalizes payment routing when registering a provider', async () => {
    const initial = operatorConfiguration();
    loadConfiguration.mockResolvedValue(initial);
    saveConfiguration.mockImplementation(async request => ({
      ...initial,
      payment: {
        ...initial.payment,
        providerId: request.payment.providerId,
        publicBaseUrl: request.payment.publicBaseUrl,
        merchantAccount: request.payment.merchantAccount || null,
        credentialConfigured: true,
        credentialMask: '••••ment'
      }
    }));
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();
    store.setConfigurationPayment({
      providerId: 'stripe',
      publicBaseUrl: ' https://community.example.test/ ',
      merchantAccount: '',
      credential: 'write-only-payment'
    });

    await store.saveConfiguration('register-payment');

    expect(saveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: {
          providerId: 'stripe',
          publicBaseUrl: 'https://community.example.test',
          merchantAccount: '',
          credential: 'write-only-payment'
        }
      })
    );
    expect(store.configuration()?.payment.publicBaseUrl)
      .toBe('https://community.example.test');
  });

  it('normalizes and saves root administrator and social-link configuration', async () => {
    const initial = operatorConfiguration();
    loadConfiguration.mockResolvedValue(initial);
    saveConfiguration.mockImplementation(async request => ({
      ...initial,
      adminEmails: request.adminEmails,
      privacyContact: {
        configured: Boolean(
          request.privacyContact.dataControllerName
          && request.privacyContact.privacyContactEmail
        ),
        dataControllerName:
          request.privacyContact.dataControllerName.trim(),
        privacyContactEmail:
          request.privacyContact.privacyContactEmail.trim().toLowerCase()
      },
      socialLinks: request.socialLinks,
      updatedAt: '2026-07-28T19:00:00.000Z'
    }));
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.loadConfiguration();
    store.setConfigurationAdminEmailsInput(
      ' Owner@Example.test, owner@example.test\nadmin@example.test '
    );
    store.setConfigurationPrivacyContact({
      dataControllerName: '  Example Operator s.r.o.  ',
      privacyContactEmail: ' Privacy@Example.test '
    });
    store.addConfigurationSocialLink();
    store.setConfigurationSocialLink(0, {
      provider: 'community',
      label: 'Community',
      url: 'https://community.example.test',
      icon: 'forum',
      handle: '@community'
    });

    await store.saveConfiguration('save-social-links');

    expect(saveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmails: ['owner@example.test', 'admin@example.test'],
        privacyContact: {
          dataControllerName: '  Example Operator s.r.o.  ',
          privacyContactEmail: ' Privacy@Example.test '
        },
        socialLinks: [{
          provider: 'community',
          label: 'Community',
          url: 'https://community.example.test/',
          icon: 'forum',
          handle: '@community'
        }]
      })
    );
    expect(store.configuration()?.adminEmails).toEqual([
      'owner@example.test',
      'admin@example.test'
    ]);
    expect(store.configuration()?.privacyContact).toEqual({
      configured: true,
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'privacy@example.test'
    });
    expect(store.configurationPrivacyContactReady()).toBe(true);
    expect(applyPrivacyContact).toHaveBeenLastCalledWith(
      store.configuration()?.privacyContact
    );
    expect(store.configuration()?.socialLinks[0]?.provider).toBe('community');
  });

  it('rejects a partial privacy contact before saving', async () => {
    loadConfiguration.mockResolvedValue(operatorConfiguration());
    const store = TestBed.inject(OperatorWorkspaceStore);
    await store.loadConfiguration();
    store.setConfigurationPrivacyContact({
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: ''
    });

    await store.saveConfiguration('save-privacy-contact');

    expect(store.configurationPrivacyContactValidationKey())
      .toBe('operator.configuration.privacy.contact.incomplete');
    expect(saveConfiguration).not.toHaveBeenCalled();
  });
});

function claimStatus(): OperatorClaimStatusDto {
  return {
    claimed: true,
    claimedAt: '2026-07-28T18:00:00.000Z',
    claimantUserId: 'operator-real',
    claimantName: 'Verified Operator',
    claimantAvatarUrl: 'https://cdn.example.test/operator.webp',
    operatorGroupId: 'operator-group-real',
    activeLinkId: null,
    sharePercent: 4.25,
    shareNumerator: '17',
    shareDenominator: '400',
    verificationCapability: 'AVAILABLE',
    verificationUnavailableReason: null,
    verificationStatus: 'PENDING_REVIEW',
    verificationSubmittedAt: '2026-07-28T18:00:00.000Z',
    legalName: 'Example Operator s.r.o.',
    eligibilityStatus: 'INACTIVE'
  };
}

function claimSubmission(): OperatorClaimRequestDto {
  return {
    legalName: 'Example Operator s.r.o.',
    registrationNumber: '51 234 567',
    jurisdiction: 'Slovakia',
    registeredAddress: 'Main Street 1, Bratislava',
    website: 'https://operator.example.test/',
    verificationContactName: 'Authorized Contact',
    verificationContactRole: 'Managing director',
    verificationContactEmail: 'contact@example.test',
    authorityAttested: true
  };
}

function unclaimedStatus(): OperatorClaimStatusDto {
  return {
    claimed: false,
    claimedAt: null,
    claimantUserId: null,
    claimantName: null,
    claimantAvatarUrl: null,
    operatorGroupId: null,
    activeLinkId: null,
    sharePercent: 0,
    shareNumerator: null,
    shareDenominator: null,
    verificationCapability: 'AVAILABLE',
    verificationUnavailableReason: null,
    verificationStatus: 'NOT_SUBMITTED',
    verificationSubmittedAt: null,
    legalName: null,
    eligibilityStatus: 'INACTIVE'
  };
}

function deploymentUpdate(availableVersion: string): OperatorDeploymentUpdateDto {
  return {
    currentVersion: '1.0.0',
    availableVersion,
    updateAvailable: true,
    lastCheckedAt: '2026-07-28T18:00:00.000Z',
    lastUpdatedAt: null,
    progress: {
      phase: 'IDLE',
      bytesDownloaded: 0,
      bytesTotal: 1024,
      percent: 0,
      message: null,
      updatedAt: '2026-07-28T18:00:00.000Z'
    }
  };
}

function operatorRevenue(): OperatorRevenueDto {
  return {
    generatedAtIso: '2026-07-28T18:00:00.000Z',
    rulesetVersion: 'net-captured-revenue-v1',
    commissionRateBasisPoints: 500,
    currencies: []
  };
}

function operatorCommunity(): OperatorCommunityStatusDto {
  return {
    availability: 'AVAILABLE',
    updatedAt: '2026-07-28T18:00:00.000Z',
    providers: [],
    announcements: []
  };
}

function operatorConfiguration(): OperatorConfigurationDto {
  return {
    capability: 'AVAILABLE',
    unavailableReason: null,
    adminEmails: [],
    privacyContact: {
      configured: false,
      dataControllerName: '',
      privacyContactEmail: ''
    },
    socialLinks: [],
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Your preferences come first',
      logoUrl: 'assets/logo/heart.webp',
      logoCharacterIndex: null,
      themePreset: 'AURORA',
      revision: 1
    },
    payment: {
      availableProviders: [],
      providerId: null,
      publicBaseUrl: null,
      merchantAccount: null,
      credentialConfigured: false,
      credentialMask: null
    },
    firebase: {
      projectId: '',
      authenticationCredentialConfigured: false,
      messagingCredentialConfigured: false,
      publicConfiguration: {
        revision: 0,
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: null,
        vapidKey: null
      },
      active: false,
      readyToActivate: false,
      authenticationTestedAt: null,
      messagingTestedAt: null,
      activatedAt: null
    },
    updatedAt: '2026-07-28T18:00:00.000Z'
  };
}
