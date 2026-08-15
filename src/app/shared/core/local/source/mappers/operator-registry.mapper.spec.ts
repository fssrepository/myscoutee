import type { OperatorLeaderboardEntryDto } from '../../../contracts/operator.interface';
import { SeedOperatorRegistryBuilder } from '../../seed/builders/operator-registry-seed.builder';
import { LocalOperatorRegistryMapper } from './operator-registry.mapper';

describe('LocalOperatorRegistryMapper', () => {
  it('migrates only the v6 local default theme from Aurora to Ocean', () => {
    const initial = SeedOperatorRegistryBuilder.buildInitialRecord(
      new Date('2026-08-15T18:50:00.000Z')
    );
    const previousDefault = structuredClone(initial);
    previousDefault.seedVersion = 'operator-workspace-v6';
    previousDefault.configuration.branding.themePreset = 'AURORA';

    const migrated = LocalOperatorRegistryMapper.toSeedRecord(
      { registryRecord: previousDefault },
      initial
    );

    expect(initial.seedVersion).toBe('operator-workspace-v7');
    expect(initial.configuration.branding.themePreset).toBe('OCEAN');
    expect(migrated.configuration.branding.themePreset).toBe('OCEAN');
  });

  it('preserves a manually selected non-default theme during the v7 migration', () => {
    const initial = SeedOperatorRegistryBuilder.buildInitialRecord(
      new Date('2026-08-15T18:50:00.000Z')
    );
    const customized = structuredClone(initial);
    customized.seedVersion = 'operator-workspace-v6';
    customized.configuration.branding.themePreset = 'FOREST';

    const migrated = LocalOperatorRegistryMapper.toSeedRecord(
      { registryRecord: customized },
      initial
    );

    expect(migrated.configuration.branding.themePreset).toBe('FOREST');
  });

  it('seeds signed release metadata in the canonical package contract', () => {
    const initial = SeedOperatorRegistryBuilder.buildInitialRecord(
      new Date('2026-07-30T09:00:00.000Z')
    );
    const artifact = initial.community.announcements
      .find(announcement => announcement.kind === 'UPDATE')
      ?.update?.artifact;

    expect(artifact?.sha256Digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(artifact?.packageSigningKeyId).toMatch(/^pkey_[0-9a-f]{32}$/);
    expect(artifact?.signature).toMatch(/^[A-Za-z0-9+/]{86}==$/);
    const decodedSignature = atob(artifact?.signature ?? '');
    expect(decodedSignature).toHaveLength(64);
    expect(btoa(decodedSignature)).toBe(artifact?.signature);
    expect(artifact?.signatureVerified).toBe(true);
  });

  it('keeps rejected claim weight measured but excludes it from share', () => {
    const entries: OperatorLeaderboardEntryDto[] = [{
      id: 'founder',
      nodeId: null,
      label: 'Founder',
      group: 'FOUNDER',
      verifiedWeight: 100,
      sharePercent: 0,
      claimed: true,
      eligibilityStatus: 'ACTIVE',
      deploymentCount: 1,
      claimVerificationStatus: null
    }, {
      id: 'opg_approved',
      nodeId: null,
      label: 'Approved Operator',
      group: 'CLAIMED',
      verifiedWeight: 300,
      sharePercent: 0,
      claimed: true,
      eligibilityStatus: 'ACTIVE',
      operatorGroupId: 'opg_approved',
      deploymentCount: 1,
      claimVerificationStatus: 'APPROVED'
    }, {
      id: 'opg_pending',
      nodeId: null,
      label: 'Pending Operator',
      group: 'CLAIMED',
      verifiedWeight: 100,
      sharePercent: 0,
      claimed: true,
      eligibilityStatus: 'INACTIVE',
      operatorGroupId: 'opg_pending',
      deploymentCount: 1,
      claimVerificationStatus: 'PENDING_REVIEW'
    }, {
      id: 'opg_rejected',
      nodeId: null,
      label: 'Rejected Operator',
      group: 'CLAIMED',
      verifiedWeight: 600,
      sharePercent: 0,
      claimed: true,
      eligibilityStatus: 'INACTIVE',
      operatorGroupId: 'opg_rejected',
      deploymentCount: 1,
      claimVerificationStatus: 'REJECTED'
    }];

    const recalculated = LocalOperatorRegistryMapper.recalculateLeaderboard(
      entries
    );

    expect(recalculated.find(item => item.id === 'opg_rejected'))
      .toEqual(expect.objectContaining({
        verifiedWeight: 600,
        sharePercent: 0,
        claimVerificationStatus: 'REJECTED'
      }));
    expect(recalculated.find(item => item.id === 'opg_approved')?.sharePercent)
      .toBeGreaterThan(0);
    expect(recalculated.find(item => item.id === 'opg_pending')?.sharePercent)
      .toBeGreaterThan(0);
  });

  it('keeps suspended weight measured while excluding it from the local share pool', () => {
    const recalculated = LocalOperatorRegistryMapper.recalculateLeaderboard([
      {
        id: 'founder',
        nodeId: null,
        label: 'Founder',
        group: 'FOUNDER',
        verifiedWeight: 100,
        sharePercent: 0,
        claimed: true,
        eligibilityStatus: 'ACTIVE'
      },
      {
        id: 'opg_active',
        nodeId: null,
        label: 'Active',
        group: 'CLAIMED',
        verifiedWeight: 300,
        sharePercent: 0,
        claimed: true,
        eligibilityStatus: 'ACTIVE',
        claimVerificationStatus: 'APPROVED'
      },
      {
        id: 'opg_suspended',
        nodeId: null,
        label: 'Suspended',
        group: 'CLAIMED',
        verifiedWeight: 600,
        sharePercent: 0,
        claimed: true,
        eligibilityStatus: 'SUSPENDED',
        claimVerificationStatus: 'APPROVED'
      }
    ]);

    expect(recalculated.find(item => item.id === 'opg_suspended'))
      .toEqual(expect.objectContaining({
        verifiedWeight: 600,
        sharePercent: 0,
        eligibilityStatus: 'SUSPENDED'
      }));
    expect(recalculated.find(item => item.id === 'opg_active')?.sharePercent)
      .toBeGreaterThan(0);
  });

  it('migrates a legacy partially suspended group without inventing a deployment state', () => {
    const initial = SeedOperatorRegistryBuilder.buildInitialRecord(
      new Date('2026-07-29T00:00:00.000Z')
    );
    const legacyEntry: OperatorLeaderboardEntryDto = {
      id: 'legacy-partial-group',
      nodeId: 'legacy-node',
      label: 'Legacy operator',
      group: 'CLAIMED',
      verifiedWeight: 300,
      eligibleWeight: 100,
      sharePercent: 10,
      claimed: true,
      claimantUserId: 'legacy-user',
      claimantName: 'Legacy operator',
      claimantAvatarUrl: null,
      operatorGroupId: 'legacy-group',
      deploymentCount: 2,
      claimVerificationStatus: 'APPROVED',
      eligibilityStatus: 'PARTIALLY_SUSPENDED'
    };
    const migrated = LocalOperatorRegistryMapper.toSeedRecord(
      {
        registryRecord: {
          ...structuredClone(initial),
          ledger: [],
          leaderboard: [legacyEntry]
        }
      },
      initial
    );

    expect(migrated.ledger).toEqual([
      expect.objectContaining({
        id: 'legacy-partial-group',
        eligibilityStatus: 'SUSPENDED'
      })
    ]);
  });
});
