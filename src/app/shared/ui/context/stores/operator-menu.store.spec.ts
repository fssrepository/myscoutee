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
