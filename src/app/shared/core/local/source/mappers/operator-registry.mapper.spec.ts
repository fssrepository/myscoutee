import type { OperatorLeaderboardEntryDto } from '../../../contracts/operator.interface';
import { LocalOperatorRegistryMapper } from './operator-registry.mapper';

describe('LocalOperatorRegistryMapper', () => {
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
});
