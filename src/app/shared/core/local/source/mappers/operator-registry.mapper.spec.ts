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
      operatorGroupId: 'opg_approved',
      deploymentCount: 1,
      claimVerificationStatus: 'APPROVED'
    }, {
      id: 'opg_rejected',
      nodeId: null,
      label: 'Rejected Operator',
      group: 'CLAIMED',
      verifiedWeight: 600,
      sharePercent: 0,
      claimed: true,
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
  });
});
