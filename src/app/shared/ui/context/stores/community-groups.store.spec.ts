import { describe, expect, it, vi } from 'vitest';
import { CommunityGroupsStore } from './community-groups.store';

describe('Group list and workspace counter synchronization', () => {
  function setup() {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const response = { upserts: [], removedIds: [], total: 2 };
    const store = Object.assign(Object.create(CommunityGroupsStore.prototype), {
      openUserId: vi.fn(() => 'account'), changes: { revision: vi.fn(() => 1) },
      service: { sync: vi.fn().mockResolvedValue(response) }, workspaces: { refresh }
    });
    return { store, refresh, response };
  }

  it('refreshes aggregate attention even when the visible bucket has no changed cards', async () => {
    const { store, refresh, response } = setup();
    expect(await store.sync({ bucket: 'explore', knownItems: [], limit: 10, tailId: null })).toBe(response);
    expect(refresh).toHaveBeenCalledExactlyOnceWith('account');
  });

  it('does not publish a poll result superseded by an account switch or mutation', async () => {
    for (const invalidation of ['account', 'mutation']) {
      const { store, refresh } = setup();
      if (invalidation === 'account') store.openUserId.mockReturnValueOnce('account').mockReturnValue('other');
      else store.changes.revision.mockReturnValueOnce(1).mockReturnValue(2);
      await expect(store.sync({ bucket: 'hosting', knownItems: [], limit: 10, tailId: null }))
        .rejects.toMatchObject({ name: 'AbortError' });
      expect(refresh).not.toHaveBeenCalled();
    }
  });
});
