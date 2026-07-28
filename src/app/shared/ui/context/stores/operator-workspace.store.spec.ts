import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { SessionService } from '../../../core/base/services/session.service';
import type { OperatorClaimStatusDto } from '../../../core/contracts/operator.interface';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';
import { OperatorWorkspaceStore } from './operator-workspace.store';
import { UserProfileStore } from './user-profile.store';

describe('OperatorWorkspaceStore', () => {
  const claimShare = vi.fn();
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
          useValue: { claimShare }
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
          useValue: { invalidate }
        },
        {
          provide: UserProfileStore,
          useValue: { activeUserProfile }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('claims with the active profile name and first safe HTTPS avatar', async () => {
    const claimed = claimStatus();
    claimShare.mockResolvedValue(claimed);
    const store = TestBed.inject(OperatorWorkspaceStore);

    const result = await store.claimShare();

    expect(result).toEqual(claimed);
    expect(claimShare).toHaveBeenCalledWith({
      operatorName: 'Verified Operator',
      operatorAvatarUrl: 'https://cdn.example.test/operator.webp'
    });
    expect(store.claimStatus()).toEqual(claimed);
    expect(store.notice()).toBe('operator.claim.completed');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('does not call Java when the active profile has no claimant name', async () => {
    activeUserProfile.set({
      id: 'operator-real',
      name: ' ',
      images: []
    });
    const store = TestBed.inject(OperatorWorkspaceStore);

    const result = await store.claimShare();

    expect(result).toBeNull();
    expect(claimShare).not.toHaveBeenCalled();
    expect(store.error()).toBe('operator.claim.error.profile.required');
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
    shareDenominator: '400'
  };
}
