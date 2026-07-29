import {
  OperatorMenuStore,
  type OperatorMenuKind
} from './operator-menu.store';

describe('OperatorMenuStore', () => {
  it('opens only the simplified functional operator popups', () => {
    const store = new OperatorMenuStore();
    const kinds: readonly OperatorMenuKind[] = [
      'updates',
      'registration',
      'claim',
      'configuration',
      'revenue',
      'community',
      'deployments'
    ];

    for (const kind of kinds) {
      store.open(kind);
      expect(store.activePopup()).toBe(kind);
    }

    store.closePopup();
    expect(store.activePopup()).toBeNull();
  });

  it('opens a deployment drilldown only for a claimed leaderboard group', () => {
    const store = new OperatorMenuStore();
    const claimed = {
      id: 'claimed-group:opg_test',
      nodeId: null,
      label: 'Test operator',
      group: 'CLAIMED' as const,
      verifiedWeight: 42,
      sharePercent: 4.2,
      claimed: true,
      operatorGroupId: ' opg_test ',
      deploymentCount: 2
    };

    store.openLeaderboardDeployments(claimed);

    expect(store.activePopup()).toBe('deployments');
    expect(store.selectedLeaderboardEntry()).toEqual({
      ...claimed,
      operatorGroupId: 'opg_test'
    });

    store.closePopup();
    store.openLeaderboardDeployments({
      ...claimed,
      id: 'unclaimed',
      group: 'UNCLAIMED',
      operatorGroupId: null
    });
    expect(store.activePopup()).toBeNull();
    expect(store.selectedLeaderboardEntry()?.id).toBe(claimed.id);
  });
});
