import { OperatorLeaderboardSingleRowConverter } from './operator-leaderboard-single-row.converter';

describe('OperatorLeaderboardSingleRowConverter', () => {
  it('renders a pending claim as a warning row with an under-review badge', () => {
    const row = new OperatorLeaderboardSingleRowConverter().convert({
      id: 'opg_pending',
      nodeId: 'dep_pending',
      label: 'Pending Operator',
      group: 'CLAIMED',
      verifiedWeight: 12_000,
      sharePercent: 5.54,
      claimed: true,
      operatorGroupId: 'opg_pending',
      deploymentCount: 1,
      claimVerificationStatus: 'PENDING_REVIEW'
    }, {
      locale: 'en',
      shareLabel: 'share',
      unitsLabel: 'contribution units',
      deploymentLabel: 'deployment',
      deploymentsLabel: 'deployments',
      pendingReviewLabel: 'Under review'
    });

    expect(row.surfaceTone).toBe('warning');
    expect(row.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Under review',
        tone: 'warning',
        position: 'top-right'
      })
    ]));
    expect(row.badges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '5.54%' })
    ]));
  });

  it('renders a rejected claim as danger without a zero-share badge', () => {
    const row = new OperatorLeaderboardSingleRowConverter().convert({
      id: 'opg_rejected',
      nodeId: 'dep_rejected',
      label: 'Rejected Operator',
      group: 'CLAIMED',
      verifiedWeight: 12_000,
      sharePercent: 0,
      claimed: true,
      operatorGroupId: 'opg_rejected',
      deploymentCount: 1,
      claimVerificationStatus: 'REJECTED'
    }, {
      locale: 'en',
      shareLabel: 'share',
      unitsLabel: 'contribution units',
      deploymentLabel: 'deployment',
      deploymentsLabel: 'deployments',
      rejectedReviewLabel: 'Review rejected'
    });

    expect(row.surfaceTone).toBe('danger');
    expect(row.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Review rejected',
        icon: 'block',
        tone: 'danger',
        position: 'top-right'
      })
    ]));
    expect(row.badges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '0.0%' })
    ]));
  });
});
