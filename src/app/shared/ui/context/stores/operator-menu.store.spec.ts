import {
  OperatorMenuStore,
  type OperatorMenuKind
} from './operator-menu.store';

describe('OperatorMenuStore', () => {
  it('opens every operator workspace, including Registry, through the popup signal', () => {
    const store = new OperatorMenuStore();
    const kinds: readonly OperatorMenuKind[] = [
      'registry',
      'branding',
      'payments',
      'firebase',
      'leaderboard',
      'connections',
      'updates',
      'community'
    ];

    for (const kind of kinds) {
      store.open(kind);
      expect(store.activePopup()).toBe(kind);
    }

    store.closePopup();
    expect(store.activePopup()).toBeNull();
  });
});
