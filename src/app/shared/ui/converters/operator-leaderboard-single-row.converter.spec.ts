import { OperatorLeaderboardSingleRowConverter } from './operator-leaderboard-single-row.converter';

describe('OperatorLeaderboardSingleRowConverter', () => {
  it('renders a pending claim with both its review state and indicative share', () => {
    const row = new OperatorLeaderboardSingleRowConverter().convert({
      id: 'opg_pending',
      nodeId: 'dep_pending',
      label: 'Pending Operator',
      group: 'CLAIMED',
      verifiedWeight: 12_000,
      sharePercent: 5.54,
      claimed: true,
      eligibilityStatus: 'INACTIVE',
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
    expect(row.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: '5.54%',
        tone: 'accent',
        position: 'top-right'
      })
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
      eligibilityStatus: 'INACTIVE',
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

  it('keeps suspended measured weight visible but never presents the claim as eligible', () => {
    const row = new OperatorLeaderboardSingleRowConverter().convert({
      id: 'opg_suspended',
      nodeId: null,
      label: 'Suspended Operator',
      group: 'CLAIMED',
      verifiedWeight: 42_000,
      sharePercent: 0,
      claimed: true,
      eligibilityStatus: 'SUSPENDED',
      operatorGroupId: 'opg_suspended',
      deploymentCount: 1,
      claimVerificationStatus: 'APPROVED'
    }, {
      locale: 'en',
      unitsLabel: 'contribution units',
      suspendedEligibilityLabel: 'Suspended'
    });

    expect(row.surfaceTone).toBe('danger');
    expect(row.detail).toBe('42,000 contribution units');
    expect(row.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Suspended',
        icon: 'pause_circle',
        tone: 'danger'
      }),
      expect.objectContaining({
        label: '0.0%',
        tone: 'muted'
      })
    ]));
  });

  it('renders a mixed group as partially suspended rather than fully eligible', () => {
    const row = new OperatorLeaderboardSingleRowConverter().convert({
      id: 'opg_mixed',
      nodeId: null,
      label: 'Mixed Operator',
      group: 'CLAIMED',
      verifiedWeight: 65_000,
      sharePercent: 12.5,
      claimed: true,
      eligibilityStatus: 'PARTIALLY_SUSPENDED',
      operatorGroupId: 'opg_mixed',
      deploymentCount: 2,
      claimVerificationStatus: 'APPROVED'
    }, {
      locale: 'en',
      partiallySuspendedEligibilityLabel: 'Partially suspended'
    });

    expect(row.surfaceTone).toBe('warning');
    expect(row.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Partially suspended',
        tone: 'warning'
      }),
      expect.objectContaining({
        label: '12.5%',
        tone: 'accent'
      })
    ]));
  });
});
