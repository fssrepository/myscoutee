import {
  OperatorMenuStore,
  type OperatorMenuKind,
  type OperatorRegistrySection
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
    expect(store.registrySection()).toBe('configuration');
  });

  it('opens the Registry popup at a requested workflow section', () => {
    const store = new OperatorMenuStore();
    const sections: readonly OperatorRegistrySection[] = [
      'configuration',
      'identity',
      'deployment',
      'receipt'
    ];

    for (const section of sections) {
      store.openRegistry(section);
      expect(store.activePopup()).toBe('registry');
      expect(store.registrySection()).toBe(section);
    }

    store.open('registry');
    expect(store.registrySection()).toBe('configuration');
  });
});
