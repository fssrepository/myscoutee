import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
import { SeedOperatorRegistryRepository } from '../../seed/repositories/operator-registry-seed.repository';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { LocalOperatorRegistryService } from './operator-registry.service';

describe('LocalOperatorRegistryService', () => {
  let memoryDb: LocalMemoryDb;
  let waitForDelay: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    waitForDelay = vi.spyOn(
      TestBed.inject(RouteDelayService),
      'waitForDelay'
    ).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('hydrates once and keeps the seeded ledger, audit, leaderboard, and mutations coherent', async () => {
    const diskReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const diskWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const seedRepository = TestBed.inject(SeedOperatorRegistryRepository);
    const seedContext = await seedRepository.prepareBootstrap();
    await seedRepository.seedUsers(seedContext);
    await seedRepository.seedRegistry(seedContext);

    const repository = TestBed.inject(LocalOperatorRegistryRepository);
    const service = TestBed.inject(LocalOperatorRegistryService);
    const initial = await service.loadStatus();
    const registered = await service.register({
      registryBaseUrl: 'https://registry.myscoutee.invalid',
      expectedRegistryScope: 'demo:primary'
    });
    const explicitClaim = await service.claimShare({
      legalName: 'Demo Operator s.r.o.',
      registrationNumber: '51 234 567',
      jurisdiction: 'Slovakia',
      registeredAddress: 'Main Street 1, Bratislava',
      website: 'https://operator.example.test',
      verificationContactName: 'Demo Operator',
      verificationContactRole: 'Managing director',
      verificationContactEmail: 'operator@example.test',
      authorityAttested: true
    });
    const ledgerBeforeGrouping = (await repository.read())?.ledger;
    const community = await service.loadCommunityStatus();
    const revenue = await service.loadRevenue();
    const leaderboard = await service.leaderboardPage({
      page: 0,
      pageSize: 20,
      sort: 'share',
      direction: 'desc'
    });
    const cached = await repository.read();

    expect(initial.lifecycle).toBe('UNCONFIGURED');
    expect(initial.registryOptions).toHaveLength(3);
    expect(registered.lifecycle).toBe('REGISTERED');
    expect(explicitClaim.claimed).toBe(true);
    expect(explicitClaim.verificationStatus).toBe('PENDING_REVIEW');
    expect(explicitClaim.claimedAt).toBe(explicitClaim.verificationSubmittedAt);
    expect(explicitClaim.claimantName).toBe('Demo Operator s.r.o.');
    expect(cached?.ledger).toEqual(ledgerBeforeGrouping);
    expect(cached?.ledger.find(item => item.id === 'node-operator-demo')).toEqual(
      expect.objectContaining({
        claimed: true,
        claimantUserId: 'operator-demo-dev',
        claimantName: 'Demo Operator s.r.o.'
      })
    );
    expect(cached?.claimVerificationRequest).toEqual({
      legalName: 'Demo Operator s.r.o.',
      registrationNumber: '51 234 567',
      jurisdiction: 'Slovakia',
      registeredAddress: 'Main Street 1, Bratislava',
      website: 'https://operator.example.test/',
      verificationContactName: 'Demo Operator',
      verificationContactRole: 'Managing director',
      verificationContactEmail: 'operator@example.test',
      authorityAttested: true
    });
    expect(cached?.leaderboard.find(
      item => item.operatorGroupId === explicitClaim.operatorGroupId
    )).toEqual(
      undefined
    );
    expect(cached?.auditHistory.map(item => item.kind)).toEqual(
      expect.arrayContaining(['SEED', 'REGISTER', 'CLAIM'])
    );
    expect(community.providers).toEqual([
      expect.objectContaining({
        id: 'discord',
        purpose: 'operator.community.provider.discord.purpose',
        configured: false,
        available: true
      }),
      expect.objectContaining({
        id: 'discourse',
        purpose: 'operator.community.provider.discourse.purpose',
        configured: false,
        available: true
      })
    ]);
    expect(revenue).toEqual(expect.objectContaining({
      rulesetVersion: 'net-captured-revenue-v1',
      commissionRateBasisPoints: 500,
      currencies: [
        expect.objectContaining({
          currencyCode: 'USD',
          fractionDigits: 2,
          netPaymentMinor: 49_800,
          estimatedCommissionMinor: 2_490
        })
      ]
    }));
    expect(leaderboard.items[0]).toEqual(expect.objectContaining({
      group: 'FOUNDER',
      verifiedWeight: 100_000
    }));

    expect(diskReadSpy.mock.calls.filter(
      ([key]: [string]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toHaveLength(1);
    expect(diskWriteSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toHaveLength(4);
    expect(waitForDelay).toHaveBeenCalledTimes(6);
    expect(waitForDelay).toHaveBeenCalledWith(
      1500,
      undefined,
      'operator.request.aborted'
    );
  });

  it('submits an unclaimed client-code claim with provisional leaderboard grouping', async () => {
    const seedRepository = TestBed.inject(SeedOperatorRegistryRepository);
    const seedContext = await seedRepository.prepareBootstrap();
    await seedRepository.seedUsers(seedContext);
    await seedRepository.seedRegistry(seedContext);

    const repository = TestBed.inject(LocalOperatorRegistryRepository);
    const service = TestBed.inject(LocalOperatorRegistryService);
    await service.register({
      registryBaseUrl: 'https://registry.myscoutee.invalid',
      expectedRegistryScope: 'demo:primary'
    });
    const before = await repository.read();
    expect(before).not.toBeNull();
    await repository.write({
      ...before!,
      groupingTokens: [{
        token: 'temporary-client-code',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        redeemedAt: null,
        operatorGroupId: 'operator-group-campus'
      }]
    });

    const claim = await service.linkOperatorGroup({
      clientToken: 'temporary-client-code'
    });
    const after = await repository.read();

    expect(claim).toEqual(expect.objectContaining({
      claimed: true,
      operatorGroupId: 'operator-group-campus',
      verificationStatus: 'PENDING_REVIEW'
    }));
    expect(claim.claimedAt).toBe(claim.verificationSubmittedAt);
    expect(claim.sharePercent).toBeGreaterThan(0);
    expect(after?.ledger.find(item => item.nodeId === 'node-operator-demo'))
      .toEqual(expect.objectContaining({
        claimed: true,
        claimantUserId: 'operator-campus'
      }));
    expect(after?.groupLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'node-operator-demo',
        operatorGroupId: 'operator-group-campus'
      })
    ]));
    const claimedGroup = after?.leaderboard.find(
      item => item.group === 'CLAIMED'
        && item.operatorGroupId === 'operator-group-campus'
    );
    expect(claimedGroup).toEqual(expect.objectContaining({
      deploymentCount: 3,
      sharePercent: claim.sharePercent
    }));
    expect(after?.leaderboard).not.toEqual(before?.leaderboard);
    expect(after?.groupingTokens[0]?.redeemedAt).not.toBeNull();
    expect(after?.auditHistory.at(-1)).toEqual(expect.objectContaining({
      kind: 'CLAIM',
      detail: 'Client code claim submitted for registry review.'
    }));
  });

  it('regroups an already claimed deployment without replacing its verification', async () => {
    const seedRepository = TestBed.inject(SeedOperatorRegistryRepository);
    const seedContext = await seedRepository.prepareBootstrap();
    await seedRepository.seedUsers(seedContext);
    await seedRepository.seedRegistry(seedContext);

    const repository = TestBed.inject(LocalOperatorRegistryRepository);
    const service = TestBed.inject(LocalOperatorRegistryService);
    await service.register({
      registryBaseUrl: 'https://registry.myscoutee.invalid',
      expectedRegistryScope: 'demo:primary'
    });
    await service.claimShare({
      legalName: 'Verified Demo Operator',
      registrationNumber: '51 234 567',
      jurisdiction: 'Slovakia',
      registeredAddress: 'Main Street 1, Bratislava',
      website: 'https://operator.example.test',
      verificationContactName: 'Demo Operator',
      verificationContactRole: 'Managing director',
      verificationContactEmail: 'operator@example.test',
      authorityAttested: true
    });
    const claimed = await repository.read();
    expect(claimed).not.toBeNull();
    await repository.write({
      ...claimed!,
      claimStatus: {
        ...claimed!.claimStatus,
        verificationStatus: 'APPROVED'
      },
      groupingTokens: [{
        token: 'approved-client-code',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        redeemedAt: null,
        operatorGroupId: 'operator-group-campus'
      }]
    });
    const beforeRegroup = await repository.read();

    const regrouped = await service.linkOperatorGroup({
      clientToken: 'approved-client-code'
    });
    const afterRegroup = await repository.read();

    expect(regrouped).toEqual(expect.objectContaining({
      claimed: true,
      claimantName: 'Verified Demo Operator',
      operatorGroupId: 'operator-group-campus',
      verificationStatus: 'APPROVED'
    }));
    expect(afterRegroup?.ledger).toEqual(beforeRegroup?.ledger);
    expect(afterRegroup?.groupLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'node-operator-demo',
        operatorGroupId: 'operator-group-campus'
      })
    ]));
    expect(afterRegroup?.leaderboard.find(
      item => item.group === 'CLAIMED'
        && item.operatorGroupId === 'operator-group-campus'
    )).toEqual(expect.objectContaining({
      deploymentCount: 3,
      sharePercent: regrouped.sharePercent
    }));
    expect(afterRegroup?.auditHistory.at(-1)).toEqual(expect.objectContaining({
      kind: 'GROUP_LINK',
      detail: 'Claimed deployment linked to an operator group.'
    }));
  });

  it('does not manufacture replacement workspace data when the seed is absent', async () => {
    const diskWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const service = TestBed.inject(LocalOperatorRegistryService);

    await expect(service.loadStatus()).rejects.toThrow(
      'operator.workspace.error.unavailable'
    );

    expect(diskWriteSpy.mock.calls.some(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toBe(false);
  });

  it('streams update phases from the service and exposes seeded release metadata', async () => {
    const diskWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const seedRepository = TestBed.inject(SeedOperatorRegistryRepository);
    const seedContext = await seedRepository.prepareBootstrap();
    await seedRepository.seedUsers(seedContext);
    await seedRepository.seedRegistry(seedContext);
    const service = TestBed.inject(LocalOperatorRegistryService);
    const phases: string[] = [];

    const initial = await service.loadDeploymentUpdate();
    const updated = await service.applyDeploymentUpdate(progress => {
      phases.push(progress.phase);
    });
    const community = await service.loadCommunityStatus();

    expect(initial.updateAvailable).toBe(true);
    expect(initial.progress).toEqual(expect.objectContaining({
      phase: 'IDLE',
      bytesTotal: 18_874_368
    }));
    expect(phases).toEqual([
      'CHECKING',
      'DOWNLOADING',
      'DOWNLOADING',
      'DOWNLOADING',
      'DOWNLOADING',
      'VERIFYING',
      'INSTALLING',
      'COMPLETED'
    ]);
    expect(updated).toEqual(expect.objectContaining({
      currentVersion: '1.1.0',
      updateAvailable: false,
      progress: expect.objectContaining({
        phase: 'COMPLETED',
        bytesDownloaded: 18_874_368,
        percent: 100
      })
    }));
    expect(community.announcements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'UPDATE',
        status: 'PUBLISHED',
        unread: true,
        update: expect.objectContaining({
          version: '1.1.0',
          artifact: expect.objectContaining({
            downloadUrl: 'https://github.com/fssrepository/myscoutee/releases/download/v1.1.0/myscoutee_1.1.0_amd64.deb',
            downloadUrlVerified: true,
            sizeBytes: 18_874_368
          })
        })
      }),
      expect.objectContaining({
        kind: 'MAINTENANCE',
        status: 'PUBLISHED'
      })
    ]));
    expect(diskWriteSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toHaveLength(9);
  });

  it('persists deployment branding and write-only integration registration in Explore', async () => {
    const seedRepository = TestBed.inject(SeedOperatorRegistryRepository);
    const seedContext = await seedRepository.prepareBootstrap();
    await seedRepository.seedUsers(seedContext);
    await seedRepository.seedRegistry(seedContext);
    const service = TestBed.inject(LocalOperatorRegistryService);

    const initial = await service.loadConfiguration();
    expect(initial.payment.availableProviders).toEqual([
      {
        id: 'stripe',
        label: 'Stripe',
        logoUrl: 'assets/payment-providers/stripe.svg',
        logoAlt: 'Stripe',
        palette: 'violet'
      },
      {
        id: 'barion',
        label: 'Barion',
        logoUrl: 'assets/payment-providers/barion.svg',
        logoAlt: 'Barion',
        palette: 'blue'
      }
    ]);
    const saved = await service.saveConfiguration({
      branding: {
        productName: 'Community Hub',
        homeLabel: 'Meet locally',
        logoUrl: 'data:image/png;base64,c2FtcGxl',
        logoCharacterIndex: null,
        themePreset: 'OCEAN'
      },
      payment: {
        providerId: 'stripe',
        credential: 'stripe-explore-secret'
      },
      firebase: {
        projectId: 'community-hub-explore',
        authenticationCredential: 'firebase-auth-secret',
        messagingCredential: 'firebase-messaging-secret'
      }
    });
    const authentication = await service.testConfiguration({
      kind: 'FIREBASE_AUTHENTICATION'
    });
    const messaging = await service.testConfiguration({
      kind: 'FIREBASE_MESSAGING'
    });
    const persisted = await service.loadConfiguration();

    expect(initial.firebase.authenticationCredentialConfigured).toBe(false);
    expect(saved).toEqual(expect.objectContaining({
      branding: expect.objectContaining({
        productName: 'Community Hub',
        themePreset: 'OCEAN',
        revision: 1
      }),
      payment: expect.objectContaining({
        providerId: 'stripe',
        credentialConfigured: true,
        credentialMask: '••••cret'
      }),
      firebase: {
        projectId: 'community-hub-explore',
        authenticationCredentialConfigured: true,
        messagingCredentialConfigured: true
      }
    }));
    expect(authentication.success).toBe(true);
    expect(messaging.success).toBe(true);
    expect(persisted).toEqual(saved);
    expect(JSON.stringify(await TestBed.inject(LocalOperatorRegistryRepository).read()))
      .not.toContain('stripe-explore-secret');
    expect(JSON.stringify(await TestBed.inject(LocalOperatorRegistryRepository).read()))
      .not.toContain('firebase-auth-secret');
    expect(waitForDelay).toHaveBeenCalledWith(
      1500,
      undefined,
      'operator.request.aborted'
    );
  });
});
