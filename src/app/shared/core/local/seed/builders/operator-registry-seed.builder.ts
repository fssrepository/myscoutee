import type { OperatorRegistryStatusDto } from '../../../contracts/operator.interface';
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
  static readonly PRIMARY_BASE_URL = 'https://registry.myscoutee.invalid';
  static readonly PRIMARY_SCOPE = 'demo:primary';

  static buildInitialRecord(now = new Date()): OperatorRegistryStateRecord {
    const nowIso = now.toISOString();
    return LocalOperatorRegistryMapper.toRecord(
      this.buildInitialStatus(now),
      {
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
          legalName: null
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
          branding: {
            productName: 'MyScoutee',
            homeLabel: 'Your preferences come first',
            logoUrl: 'assets/logo/heart.webp',
            themePreset: 'AURORA',
            revision: 0
          },
          payment: {
            availableProviders: [
              {
                id: 'stripe',
                label: 'Stripe'
              },
              {
                id: 'barion',
                label: 'Barion'
              }
            ],
            providerId: null,
            credentialConfigured: false,
            credentialMask: null
          },
          firebase: {
            projectId: 'myscoutee-explore',
            authenticationCredentialConfigured: false,
            messagingCredentialConfigured: false
          },
          updatedAt: nowIso
        },
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
                  sha256Digest: '7e3d57c2c68793c0d4a25e94db5f4ba1d9a50e2b3f62c789417eaa35b610cd28',
                  signature: 'ed25519:4f45c8dc7a37c7118c1b9b53b36ba57d2bf873f8667f76745673d964ee4547b7',
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
      memory,
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
        founder: true,
        verifiedWeight: 100_000,
        claimed: true,
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
        founder: false,
        verifiedWeight: 50_000,
        claimed: true,
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
        founder: false,
        verifiedWeight: 15_000,
        claimed: true,
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
        founder: false,
        verifiedWeight: 30_000,
        claimed: true,
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
        founder: false,
        verifiedWeight: 20_000,
        claimed: true,
        claimantUserId: 'operator-club',
        claimantName: 'Club Operator',
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: measuredAt
      },
      {
        id: 'node-operator-demo',
        nodeId: 'node-operator-demo',
        label: 'operator.leaderboard.seed.this.deployment',
        founder: false,
        verifiedWeight: 12_000,
        claimed: false,
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      },
      {
        id: 'node-north',
        nodeId: 'node-north',
        label: 'operator.leaderboard.seed.north',
        founder: false,
        verifiedWeight: 9_000,
        claimed: false,
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      },
      {
        id: 'node-east',
        nodeId: 'node-east',
        label: 'operator.leaderboard.seed.east',
        founder: false,
        verifiedWeight: 6_000,
        claimed: false,
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        measuredAt,
        claimedAt: null
      }
    ];
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
