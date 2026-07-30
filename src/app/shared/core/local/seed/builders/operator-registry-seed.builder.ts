import type {
  OperatorRegistryStatusDto,
  OperatorRevenueDto,
  OperatorSettlementDto
} from '../../../contracts/operator.interface';
import type { AppMemorySchema } from '../../common/memory.schema';
import { USERS_TABLE_NAME, type UserRecord } from '../../source/entity/user.entity';
import { LocalOperatorRegistryMapper } from '../../source/mappers/operator-registry.mapper';
import type {
  OperatorRegistrySeedMemory,
  OperatorLedgerNodeRecord,
  OperatorRegistryStateRecord
} from '../../source/entity/operator.entity';

export interface OperatorBootstrapSeedMemory extends OperatorRegistrySeedMemory {
  readonly appState: AppMemorySchema;
}

export interface OperatorBootstrapSeedResult {
  readonly appState: AppMemorySchema;
  readonly registryRecord: OperatorRegistryStateRecord;
  readonly registryChanged: boolean;
  readonly usersChanged: boolean;
}

export class SeedOperatorRegistryBuilder {
  static readonly SEED_VERSION = 'operator-workspace-v6';
  static readonly PRIMARY_BASE_URL = 'https://registry.myscoutee.invalid';
  static readonly PRIMARY_SCOPE = 'demo:primary';

  static buildInitialRecord(now = new Date()): OperatorRegistryStateRecord {
    const nowIso = now.toISOString();
    return LocalOperatorRegistryMapper.toRecord(
      this.buildInitialStatus(now),
      {
        seedVersion: this.SEED_VERSION,
        ledger: this.buildInitialLedger(now),
        groupLinks: [
          {
            nodeId: 'node-campus',
            operatorGroupId: 'operator-group-campus',
            linkedAt: nowIso
          },
          {
            nodeId: 'node-campus-east',
            operatorGroupId: 'operator-group-campus',
            linkedAt: nowIso
          },
          {
            nodeId: 'node-city',
            operatorGroupId: 'operator-group-city',
            linkedAt: nowIso
          },
          {
            nodeId: 'node-club',
            operatorGroupId: 'operator-group-club',
            linkedAt: nowIso
          }
        ],
        claimIdentity: {
          nodeId: 'node-operator-demo',
          claimantUserId: 'operator-demo-dev',
          claimantName: 'Demo Operator',
          claimantAvatarUrl: null,
          operatorGroupId: 'operator-group-demo'
        },
        auditHistory: [
          {
            id: 'audit-seed-founder',
            kind: 'SEED',
            at: nowIso,
            nodeId: null,
            detail: 'Founder contribution model initialized.'
          },
          {
            id: 'audit-seed-demo-ledger',
            kind: 'SEED',
            at: nowIso,
            nodeId: 'node-operator-demo',
            detail: 'Explore demo measurement ledger initialized.'
          }
        ],
        claimStatus: {
          claimed: false,
          claimedAt: null,
          claimantUserId: null,
          claimantName: null,
          claimantAvatarUrl: null,
          operatorGroupId: null,
          sharePercent: 0,
          verificationCapability: 'AVAILABLE',
          verificationUnavailableReason: null,
          verificationStatus: 'NOT_SUBMITTED',
          verificationSubmittedAt: null,
          legalName: null,
          eligibilityStatus: 'INACTIVE'
        },
        claimVerificationRequest: null,
        deploymentUpdate: {
          currentVersion: '1.0.0',
          availableVersion: '1.1.0',
          updateAvailable: true,
          lastCheckedAt: nowIso,
          lastUpdatedAt: null,
          progress: {
            phase: 'IDLE',
            bytesDownloaded: 0,
            bytesTotal: 18_874_368,
            percent: 0,
            message: null,
            updatedAt: nowIso
          }
        },
        configuration: {
          capability: 'AVAILABLE',
          unavailableReason: null,
          adminEmails: [],
          privacyContact: {
            configured: true,
            dataControllerName: 'MyScoutee Explore Operator',
            privacyContactEmail: 'privacy@explore.myscoutee.test'
          },
          socialLinks: [
            {
              provider: 'instagram',
              label: 'Instagram',
              url: 'https://www.instagram.com/myscoutee',
              icon: 'photo_camera',
              handle: '@myscoutee'
            },
            {
              provider: 'youtube',
              label: 'YouTube',
              url: 'https://www.youtube.com/@myscoutee',
              icon: 'smart_display',
              handle: '@myscoutee'
            },
            {
              provider: 'facebook',
              label: 'Facebook',
              url: 'https://www.facebook.com/myscoutee',
              icon: 'public',
              handle: 'MyScoutee'
            }
          ],
          branding: {
            productName: 'MyScoutee',
            homeLabel: 'Your preferences come first',
            logoUrl: 'assets/logo/heart.webp',
            logoCharacterIndex: null,
            themePreset: 'AURORA',
            revision: 0
          },
          payment: {
            availableProviders: [
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
            ],
            providerId: null,
            publicBaseUrl: null,
            merchantAccount: null,
            credentialConfigured: false,
            credentialMask: null
          },
          firebase: {
            projectId: 'myscoutee-explore',
            authenticationCredentialConfigured: false,
            messagingCredentialConfigured: false,
            publicConfiguration: {
              revision: 0,
              apiKey: '',
              authDomain: '',
              projectId: 'myscoutee-explore',
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
          updatedAt: nowIso
        },
        revenue: this.buildInitialRevenue(now),
        settlements: this.buildInitialSettlements(),
        community: {
          availability: 'AVAILABLE',
          updatedAt: nowIso,
          providers: [
            {
              id: 'discord',
              name: 'Discord',
              purpose: 'operator.community.provider.discord.purpose',
              url: 'https://discord.com/',
              configured: false,
              available: true
            },
            {
              id: 'discourse',
              name: 'Discourse',
              purpose: 'operator.community.provider.discourse.purpose',
              url: 'https://www.discourse.org/',
              configured: false,
              available: true
            }
          ],
          announcements: [
            {
              id: 'deployment-release-1.1.0',
              kind: 'UPDATE',
              severity: 'SUCCESS',
              status: 'PUBLISHED',
              unread: true,
              title: 'operator.community.announcement.update.1_1_0.title',
              body: 'operator.community.announcement.update.1_1_0.body',
              publishedAt: nowIso,
              expiresAt: null,
              links: [
                {
                  id: 'release-notes',
                  label: 'operator.community.announcement.link.release.notes',
                  url: 'https://github.com/fssrepository/myscoutee/releases/tag/v1.1.0',
                  verified: true
                }
              ],
              update: {
                version: '1.1.0',
                purpose: 'operator.community.announcement.update.1_1_0.purpose',
                releaseNotes: [
                  'operator.community.announcement.update.1_1_0.note.registry',
                  'operator.community.announcement.update.1_1_0.note.workspace'
                ],
                artifact: {
                  downloadUrl: 'https://github.com/fssrepository/myscoutee/releases/download/v1.1.0/myscoutee_1.1.0_amd64.deb',
                  downloadUrlVerified: true,
                  sha256Digest: 'sha256:7e3d57c2c68793c0d4a25e94db5f4ba1d9a50e2b3f62c789417eaa35b610cd28',
                  packageSigningKeyId: 'pkey_86dfce4288ce436029e7236ac60b0604',
                  signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
                  signatureVerified: true,
                  sizeBytes: 18_874_368,
                  compatibility: 'operator.community.announcement.update.1_1_0.compatibility'
                }
              }
            },
            {
              id: 'maintenance-registry-window',
              kind: 'MAINTENANCE',
              severity: 'INFO',
              status: 'PUBLISHED',
              unread: true,
              title: 'operator.community.announcement.maintenance.registry.title',
              body: 'operator.community.announcement.maintenance.registry.body',
              publishedAt: nowIso,
              expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              links: [
                {
                  id: 'project-status',
                  label: 'operator.community.announcement.link.project',
                  url: 'https://github.com/fssrepository/myscoutee',
                  verified: true
                }
              ],
              update: null
            }
          ]
        }
      }
    );
  }

  static buildInitialStatus(now = new Date()): OperatorRegistryStatusDto {
    const nowIso = now.toISOString();
    return {
      mode: 'DEMO',
      lifecycle: 'UNCONFIGURED',
      enabled: false,
      simulation: true,
      candidateDefaults: {
        baseUrl: this.PRIMARY_BASE_URL,
        registryScope: this.PRIMARY_SCOPE
      },
      registryOptions: [
        {
          id: 'registry-primary',
          label: 'operator.registration.seed.registry.primary',
          baseUrl: this.PRIMARY_BASE_URL,
          description: 'operator.registration.seed.registry.primary.description',
          registryScope: this.PRIMARY_SCOPE,
          selected: false
        },
        {
          id: 'registry-europe',
          label: 'operator.registration.seed.registry.europe',
          baseUrl: 'https://eu-registry.myscoutee.invalid',
          description: 'operator.registration.seed.registry.europe.description',
          registryScope: 'demo:europe',
          selected: false
        },
        {
          id: 'registry-community',
          label: 'operator.registration.seed.registry.community',
          baseUrl: 'https://community-registry.myscoutee.invalid',
          description: 'operator.registration.seed.registry.community.description',
          registryScope: 'demo:community',
          selected: false
        }
      ],
      draftInspection: null,
      selection: null,
      nodeIdentity: {
        state: 'MISSING',
        initializedAt: null
      },
      enrollment: null,
      audit: {
        createdAt: nowIso,
        updatedAt: nowIso,
        lastAttemptAt: null,
        lastSuccessAt: null,
        disabledAt: null,
        updatedBy: 'operator-demo-dev'
      },
      lastError: null
    };
  }

  static buildInitialRevenue(now = new Date()): OperatorRevenueDto {
    const timelineSource = [
      ['2026-04-28', 'Apr 28', 1, 1, 18_000, 11_000, 0, 0, 0],
      ['2026-04-29', 'Apr 29', 1, 2, 12_500, 22_000, 4_200, 0, 2],
      ['2026-04-30', 'Apr 30', 0, 1, 0, 9_500, 3_800, 0, 1],
      ['2026-05-01', 'May 1', 2, 1, 26_000, 18_000, 6_200, 0, 3],
      ['2026-05-02', 'May 2', 1, 2, 14_500, 24_000, 5_300, 500, 2],
      ['2026-05-03', 'May 3', 0, 1, 0, 8_500, 0, 0, 0],
      ['2026-05-04', 'May 4', 2, 1, 31_000, 13_000, 7_800, 900, 4],
      ['2026-05-05', 'May 5', 1, 1, 16_500, 16_000, 2_900, 0, 1],
      ['2026-05-06', 'May 6', 0, 2, 0, 28_000, 6_100, 0, 3],
      ['2026-05-07', 'May 7', 2, 1, 27_500, 14_000, 4_500, 0, 2],
      ['2026-05-08', 'May 8', 1, 0, 15_500, 0, 0, 0, 0],
      ['2026-05-09', 'May 9', 1, 2, 21_000, 34_000, 8_200, 1_000, 3],
      ['2026-05-10', 'May 10', 0, 1, 0, 15_000, 3_200, 0, 1],
      ['2026-05-11', 'May 11', 0, 0, 20_000, 0, 0, 0, 0]
    ] as const;
    const commissionRateBasisPoints = 500;
    const timeline = timelineSource.map(([
      dateKey,
      label,
      payableEvents,
      payableAssets,
      projectedEventMinor,
      projectedAssetMinor,
      capturedPaymentMinor,
      refundedPaymentMinor,
      paymentCount
    ]) => {
      const netPaymentMinor = capturedPaymentMinor - refundedPaymentMinor;
      const estimatedCommissionMinor = Math.floor(
        netPaymentMinor * commissionRateBasisPoints / 10_000
      );
      return {
        dateKey,
        label,
        payableEvents,
        payableAssets,
        projectedEventMinor,
        projectedAssetMinor,
        capturedPaymentMinor,
        refundedPaymentMinor,
        netPaymentMinor,
        commissionBasisMinor: netPaymentMinor,
        estimatedCommissionMinor,
        paymentCount,
        payingUsers: paymentCount
      };
    });

    return {
      generatedAtIso: now.toISOString(),
      rulesetVersion: 'net-captured-revenue-v1',
      commissionRateBasisPoints,
      currencies: [
        {
          currencyCode: 'USD',
          fractionDigits: 2,
          payableEvents: 12,
          payableAssets: 16,
          projectedEventMinor: 202_500,
          projectedAssetMinor: 213_000,
          capturedPaymentMinor: 52_200,
          refundedPaymentMinor: 2_400,
          netPaymentMinor: 49_800,
          commissionBasisMinor: 49_800,
          estimatedCommissionMinor: 2_490,
          paymentCount: 22,
          payingUsers: 22,
          eventBuyers: 14,
          assetBorrowers: 18,
          assetCategories: [
            {
              key: 'accommodation',
              labelKey: 'operator.revenue.category.accommodation',
              icon: 'hotel',
              tone: 'gold',
              payableAssets: 6,
              projectedMinor: 84_000
            },
            {
              key: 'transport',
              labelKey: 'operator.revenue.category.transport',
              icon: 'directions_car',
              tone: 'blue',
              payableAssets: 5,
              projectedMinor: 77_000
            },
            {
              key: 'supplies',
              labelKey: 'operator.revenue.category.supplies',
              icon: 'inventory_2',
              tone: 'green',
              payableAssets: 5,
              projectedMinor: 52_000
            }
          ],
          timeline
        }
      ]
    };
  }

  static buildInitialSettlements(): OperatorSettlementDto[] {
    const beneficiaryId = `opg_${'1'.repeat(32)}`;
    const baseValuationMultiplierBasisPoints = 30_000;
    const rows = [
      {
        sequence: 1,
        period: '2026-06',
        currencyCode: 'EUR',
        fractionDigits: 2,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 50_000,
        ttmCommissionBasisMinor: 1_000_000,
        recentThreeMonthAverageMinor: 92_000,
        priorThreeMonthAverageMinor: 80_000,
        earlierThreeMonthAverageMinor: 75_000,
        acceptedAtIso: '2026-07-01T08:00:00.000Z'
      },
      {
        sequence: 2,
        period: '2026-06',
        currencyCode: 'EUR',
        fractionDigits: 2,
        revision: 2,
        supersedesSettlementId: `stl_${'0'.repeat(31)}1`,
        networkPoolMinor: 52_500,
        ttmCommissionBasisMinor: 1_050_000,
        recentThreeMonthAverageMinor: 96_000,
        priorThreeMonthAverageMinor: 81_000,
        earlierThreeMonthAverageMinor: 75_000,
        acceptedAtIso: '2026-07-02T08:00:00.000Z'
      },
      {
        sequence: 3,
        period: '2026-05',
        currencyCode: 'EUR',
        fractionDigits: 2,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 47_500,
        ttmCommissionBasisMinor: 950_000,
        recentThreeMonthAverageMinor: 81_000,
        priorThreeMonthAverageMinor: 75_000,
        earlierThreeMonthAverageMinor: 72_000,
        acceptedAtIso: '2026-06-01T08:00:00.000Z'
      },
      {
        sequence: 4,
        period: '2026-06',
        currencyCode: 'USD',
        fractionDigits: 2,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 38_000,
        ttmCommissionBasisMinor: 760_000,
        recentThreeMonthAverageMinor: 68_000,
        priorThreeMonthAverageMinor: 62_000,
        earlierThreeMonthAverageMinor: 60_000,
        acceptedAtIso: '2026-07-01T08:05:00.000Z'
      },
      {
        sequence: 5,
        period: '2026-05',
        currencyCode: 'USD',
        fractionDigits: 2,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 35_000,
        ttmCommissionBasisMinor: 700_000,
        recentThreeMonthAverageMinor: 62_000,
        priorThreeMonthAverageMinor: 60_000,
        earlierThreeMonthAverageMinor: 58_000,
        acceptedAtIso: '2026-06-01T08:05:00.000Z'
      },
      {
        sequence: 6,
        period: '2026-06',
        currencyCode: 'HUF',
        fractionDigits: 0,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 1_850_000,
        ttmCommissionBasisMinor: 37_000_000,
        recentThreeMonthAverageMinor: 3_300_000,
        priorThreeMonthAverageMinor: 3_050_000,
        earlierThreeMonthAverageMinor: 2_900_000,
        acceptedAtIso: '2026-07-01T08:10:00.000Z'
      },
      {
        sequence: 7,
        period: '2026-05',
        currencyCode: 'HUF',
        fractionDigits: 0,
        revision: 1,
        supersedesSettlementId: null,
        networkPoolMinor: 1_700_000,
        ttmCommissionBasisMinor: 34_000_000,
        recentThreeMonthAverageMinor: 3_050_000,
        priorThreeMonthAverageMinor: 2_900_000,
        earlierThreeMonthAverageMinor: 2_780_000,
        acceptedAtIso: '2026-06-01T08:10:00.000Z'
      }
    ] as const;
    return rows.map(row => {
      const settlementId =
        `stl_${row.sequence.toString(16).padStart(32, '0')}`;
      const priorGrowthBasisPoints = this.growthBasisPoints(
        row.earlierThreeMonthAverageMinor,
        row.priorThreeMonthAverageMinor
      );
      const recentGrowthBasisPoints = this.growthBasisPoints(
        row.priorThreeMonthAverageMinor,
        row.recentThreeMonthAverageMinor
      );
      const accelerationBasisPoints = Math.max(
        -10_000,
        Math.min(
          10_000,
          recentGrowthBasisPoints - priorGrowthBasisPoints
        )
      );
      const valuationAdjustmentBasisPoints = Math.max(
        -2_500,
        Math.min(
          2_500,
          Math.trunc(recentGrowthBasisPoints / 4)
          + Math.trunc(accelerationBasisPoints / 4)
        )
      );
      const effectiveValuationMultiplierBasisPoints = Math.floor(
        baseValuationMultiplierBasisPoints
        * (10_000 + valuationAdjustmentBasisPoints)
        / 10_000
      );
      const shareNumerator = '277';
      const shareDenominator = '5000';
      const ttmNetworkCommissionPoolMinor = Math.floor(
        row.ttmCommissionBasisMinor * 500 / 10_000
      );
      const indicativeNetworkValueMinor = Math.floor(
        row.ttmCommissionBasisMinor
        * effectiveValuationMultiplierBasisPoints
        / 10_000
      );
      return {
        settlementId,
        period: row.period,
        currencyCode: row.currencyCode,
        fractionDigits: row.fractionDigits,
        revision: row.revision,
        supersedesSettlementId: row.supersedesSettlementId,
        beneficiaryType: 'OPERATOR_GROUP',
        beneficiaryId,
        shareNumerator,
        shareDenominator,
        networkPoolMinor: row.networkPoolMinor,
        networkPoolAllocationMinor: Math.floor(
          row.networkPoolMinor * 277 / 5_000
        ),
        ttmCommissionBasisMinor: row.ttmCommissionBasisMinor,
        ttmNetworkCommissionPoolMinor,
        indicativeNetworkValueMinor,
        indicativeValueAllocationMinor: Math.floor(
          indicativeNetworkValueMinor * 277 / 5_000
        ),
        valuationRulesetVersion:
          'three-month-acceleration-valuation-v1',
        baseValuationMultiplierBasisPoints,
        recentThreeMonthAverageMinor:
          row.recentThreeMonthAverageMinor,
        priorThreeMonthAverageMinor:
          row.priorThreeMonthAverageMinor,
        earlierThreeMonthAverageMinor:
          row.earlierThreeMonthAverageMinor,
        recentGrowthBasisPoints,
        priorGrowthBasisPoints,
        accelerationBasisPoints,
        valuationAdjustmentBasisPoints,
        effectiveValuationMultiplierBasisPoints,
        valuationIsNonBinding: true,
        throughLedgerIndex: 40 + row.sequence,
        throughAuditIndex: 20 + row.sequence,
        throughReviewIndex: 8,
        throughEligibilityIndex: 6,
        sourceFingerprint:
          `sha256:${row.sequence.toString(16).repeat(64)}`,
        settlementHash:
          `sha256:${(row.sequence + 8).toString(16).repeat(64)}`,
        acceptedAtIso: row.acceptedAtIso
      };
    });
  }

  private static growthBasisPoints(
    previous: number,
    current: number
  ): number {
    if (previous === 0) {
      return current === 0 ? 0 : 20_000;
    }
    return Math.max(
      -10_000,
      Math.min(
        20_000,
        Math.trunc((current - previous) * 10_000 / previous)
      )
    );
  }

  static buildBootstrapMemory(
    memory: OperatorBootstrapSeedMemory,
    now = new Date()
  ): OperatorBootstrapSeedResult {
    const usersTable = memory.appState[USERS_TABLE_NAME];
    const seededOperator = this.buildDemoOperatorUser();
    const existingOperator = usersTable.byId[seededOperator.id] ?? null;
    const usersChanged = this.operatorNeedsUpdate(existingOperator);
    const operator = usersChanged
      ? this.mergeOperator(existingOperator, seededOperator)
      : existingOperator!;
    const appState = usersChanged
      ? {
          ...memory.appState,
          [USERS_TABLE_NAME]: {
            byId: {
              ...usersTable.byId,
              [operator.id]: operator
            },
            ids: usersTable.ids.includes(operator.id)
              ? [...usersTable.ids]
              : [...usersTable.ids, operator.id]
          }
        }
      : memory.appState;
    const registryRecord = LocalOperatorRegistryMapper.toSeedRecord(
      {
        registryRecord: this.normalizeSeedDeployment(memory.registryRecord)
      },
      this.buildInitialRecord(now)
    );

    return {
      appState,
      registryRecord,
      registryChanged: LocalOperatorRegistryMapper.seedRecordChanged(
        memory.registryRecord,
        registryRecord
      ),
      usersChanged
    };
  }

  static buildInitialLedger(now = new Date()): OperatorLedgerNodeRecord[] {
    const measuredAt = now.toISOString();
    return [
      {
        id: 'founder',
        nodeId: null,
        label: 'operator.leaderboard.seed.founder',
        active: true,
        founder: true,
        verifiedWeight: 100_000,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimantUserId: null,
        claimantName: 'MyScoutee',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-campus',
        nodeId: 'node-campus',
        label: 'operator.leaderboard.seed.campus',
        active: true,
        founder: false,
        verifiedWeight: 50_000,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimantUserId: 'operator-campus',
        claimantName: 'Campus Operator',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-campus-east',
        nodeId: 'node-campus-east',
        label: 'operator.leaderboard.seed.campus.east',
        active: true,
        founder: false,
        verifiedWeight: 15_000,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimantUserId: 'operator-campus',
        claimantName: 'Campus Operator',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-city',
        nodeId: 'node-city',
        label: 'operator.leaderboard.seed.city',
        active: true,
        founder: false,
        verifiedWeight: 30_000,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimantUserId: 'operator-city',
        claimantName: 'City Operator',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-club',
        nodeId: 'node-club',
        label: 'operator.leaderboard.seed.club',
        active: true,
        founder: false,
        verifiedWeight: 20_000,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimantUserId: 'operator-club',
        claimantName: 'Club Operator',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-operator-demo',
        nodeId: 'node-operator-demo',
        label: 'node-operator-demo',
        active: false,
        founder: false,
        verifiedWeight: 12_000,
        claimed: false,
        eligibilityStatus: 'INACTIVE',
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      },
      {
        id: 'node-north',
        nodeId: 'node-north',
        label: 'node-north',
        active: true,
        founder: false,
        verifiedWeight: 9_000,
        claimed: false,
        eligibilityStatus: 'INACTIVE',
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      },
      {
        id: 'node-east',
        nodeId: 'node-east',
        label: 'node-east',
        active: true,
        founder: false,
        verifiedWeight: 6_000,
        claimed: false,
        eligibilityStatus: 'INACTIVE',
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      }
    ];
  }

  private static normalizeSeedDeployment(
    record: OperatorRegistryStateRecord | null
  ): OperatorRegistryStateRecord | null {
    if (!record) {
      return null;
    }
    const next = structuredClone(record);
    const previousNodeId = next.claimIdentity.nodeId.trim();
    const deploymentCode = next.status.enrollment?.deploymentCode?.trim() ?? '';
    const nodeId = deploymentCode || previousNodeId;
    const active =
      next.status.enabled
      && next.status.lifecycle === 'REGISTERED';
    const deployment = next.ledger.find(item =>
      item.nodeId === previousNodeId
      || item.nodeId === deploymentCode
    );

    next.ledger = next.ledger
      .filter(item =>
        item === deployment
        || (item.nodeId !== previousNodeId && item.nodeId !== deploymentCode)
      )
      .map(item => {
        if (item === deployment && nodeId) {
          return {
            ...item,
            id: nodeId,
            nodeId,
            label: nodeId,
            active
          };
        }
        if (!item.founder && !item.claimed && item.nodeId) {
          return {
            ...item,
            label: item.nodeId,
            active: item.active !== false
          };
        }
        return item;
      });
    if (nodeId) {
      next.claimIdentity = {
        ...next.claimIdentity,
        nodeId
      };
      next.groupLinks = next.groupLinks.map(link =>
        link.nodeId === previousNodeId
          ? { ...link, nodeId }
          : link
      );
    }
    next.leaderboard = LocalOperatorRegistryMapper.deriveLeaderboard(
      next.ledger,
      next.groupLinks
    );
    return next;
  }

  static buildDemoOperatorUser(): UserRecord {
    return {
      id: 'operator-demo-dev',
      name: 'Demo Operator',
      age: 0,
      birthday: '',
      city: 'Demo deployment',
      height: '',
      physique: '',
      languages: ['English'],
      horoscope: '',
      initials: 'DO',
      gender: 'woman',
      statusText: 'Operator workspace',
      hostTier: 'Operator',
      traitLabel: 'Independent',
      completion: 100,
      profileFormVersion: 2,
      headline: 'Independent deployment operator',
      about: 'Configures this deployment and its signed registry connection.',
      images: [],
      profileStatus: 'public',
      operator: true,
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0,
        notifications: 0,
        adminJobs: 0,
        adminMetrics: 0
      }
    };
  }

  private static operatorNeedsUpdate(existing: UserRecord | null): boolean {
    return !existing
      || existing.operator !== true
      || existing.admin === true
      || `${existing.hostTier ?? ''}`.trim().toLowerCase() !== 'operator'
      || `${existing.statusText ?? ''}`.trim().length === 0
      || Math.trunc(Number(existing.profileFormVersion) || 0) < 2;
  }

  private static mergeOperator(
    existing: UserRecord | null,
    seeded: UserRecord
  ): UserRecord {
    if (!existing) {
      return seeded;
    }
    return {
      ...existing,
      operator: true,
      admin: false,
      hostTier: 'Operator',
      statusText: `${existing.statusText ?? ''}`.trim() || seeded.statusText,
      profileFormVersion: Math.max(2, Math.trunc(Number(existing.profileFormVersion) || 0))
    };
  }
}
