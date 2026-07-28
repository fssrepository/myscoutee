import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { SessionService } from '../../../core/base/services/session.service';
import type {
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorDeploymentUpdateDto,
  OperatorRevenueDto
} from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import { OperatorWorkspaceStore } from './operator-workspace.store';
import { UserProfileStore } from './user-profile.store';

describe('OperatorWorkspaceStore', () => {
  const claimShare = vi.fn();
  const loadClaimStatus = vi.fn();
  const loadDeploymentUpdate = vi.fn();
  const loadRevenue = vi.fn();
  const testConfiguration = vi.fn();
  const applyMutation = vi.fn();
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
    loadClaimStatus.mockReset();
    loadDeploymentUpdate.mockReset();
    loadRevenue.mockReset();
    testConfiguration.mockReset();
    applyMutation.mockReset();
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
            loadClaimStatus,
            loadDeploymentUpdate,
            loadRevenue,
            testConfiguration
          }
        },
        {
          provide: DeploymentConfigurationService,
          useValue: { applyBranding: vi.fn() }
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
          useValue: { applyMutation, invalidate: vi.fn() }
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
      removedLeaderboardEntryIds: ['dep_operator_real']
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

  it('loads and caches revenue only when its operator action is opened', async () => {
    const revenue = operatorRevenue();
    loadRevenue.mockResolvedValue(revenue);
    const store = TestBed.inject(OperatorWorkspaceStore);

    expect(store.revenue()).toBeNull();
    expect(await store.loadRevenue()).toEqual(revenue);
    expect(await store.loadRevenue()).toEqual(revenue);

    expect(store.revenue()).toEqual(revenue);
    expect(loadRevenue).toHaveBeenCalledTimes(1);
  });

  it('briefly exposes independent shared action feedback for Firebase tests', async () => {
    vi.useFakeTimers();
    testConfiguration.mockResolvedValue({
      kind: 'FIREBASE_AUTHENTICATION',
      success: true,
      message: 'operator.configuration.test.success',
      testedAt: '2026-07-28T18:00:00.000Z'
    });
    const store = TestBed.inject(OperatorWorkspaceStore);

    await store.testConfiguration('FIREBASE_AUTHENTICATION');

    expect(store.configurationAuthenticationFeedback()).toBe('success');
    expect(store.configurationMessagingFeedback()).toBeNull();
    expect(store.configurationAuthenticationTest()?.success).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(store.configurationAuthenticationFeedback()).toBeNull();
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
    legalName: 'Example Operator s.r.o.'
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
    legalName: null
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
