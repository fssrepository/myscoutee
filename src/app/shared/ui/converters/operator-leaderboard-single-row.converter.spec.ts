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
        position: 'inline'
      }),
      expect.objectContaining({
        label: '5.54%',
        position: 'top-right'
      })
    ]));
  });
});
