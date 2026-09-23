import { ContentModerationPopupComponent } from './content-moderation-popup.component';
import type { ContentModerationItem } from '../../../shared/core/contracts/content-moderation.interface';

describe('Content moderation dual filters', () => {
  const original: ContentModerationItem = { id: 'feed:post', category: 'feed', sourceId: 'post', ownerUserId: 'owner',
    title: 'Photo', imageUrl: '', submittedAtIso: '2026-09-22T10:00:00Z', status: 'under-review', version: 1,
    commandId: 'submit', reviewedBy: '', reviewedAtIso: '' };
  function popup() {
    const component = Object.create(ContentModerationPopupComponent.prototype);
    Object.assign(component, {
      category: 'all', status: 'under-review',
      workspace: { dashboard: () => ({ activeAdmin: { id: 'admin' } }) },
      state: { apply: vi.fn(), snapshot: () => ({ counts: { feed: { 'under-review': 2 }, event: { 'under-review': 3 } } }) },
      error: { set: vi.fn() }, dialogs: { open: vi.fn() }, service: { decide: vi.fn(), page: vi.fn() },
      list: { removeVisibleItems: vi.fn(), patchVisibleItem: vi.fn() }, adminMenu: { closePopup: vi.fn() }
    });
    return component;
  }
  it('puts state on the left and All/Event/Asset/Feed on the right with intersecting stored counts', () => {
    const component = popup();
    const [state, category] = component.model().toolbarControls;
    expect([state.id, state.align, category.id, category.align]).toEqual(['status', 'start', 'category', 'end']);
    expect(category.items.map((item: { id: string }) => item.id)).toEqual(['category:all', 'category:event', 'category:asset', 'category:feed']);
    expect(state.items[0].counter.value).toBe(5);
    component.category = 'feed';
    expect(component.model().toolbarControls[0].items[0].counter.value).toBe(2);
  });
  it('waits for successful save before removing a row which left the selected bucket', async () => {
    const component = popup();
    let resolve!: (value: unknown) => void;
    component.service.decide.mockReturnValue(new Promise(done => resolve = done));
    component.decide({ id: 'accepted', context: original });
    expect(component.service.decide).not.toHaveBeenCalled();
    const confirm = component.dialogs.open.mock.calls[0][0].onConfirm('');
    expect(component.list.removeVisibleItems).not.toHaveBeenCalled();
    resolve({ snapshot: { revision: 2 }, item: { ...original, status: 'accepted', version: 2 } });
    await confirm;
    expect(component.list.removeVisibleItems).toHaveBeenCalledOnce();
    expect(component.list.removeVisibleItems.mock.calls[0][0](original)).toBe(true);
    expect(component.state.apply).toHaveBeenCalledWith({ revision: 2 });
  });
  it('patches the canonical row when the current two filters still match and removes category mismatches', async () => {
    const component = popup();
    const saved = { ...original, status: 'accepted', version: 7 };
    component.service.decide.mockResolvedValue({ snapshot: {}, item: saved });
    component.decide({ id: 'accepted', context: original });
    component.status = 'accepted'; component.category = 'feed';
    await component.dialogs.open.mock.calls[0][0].onConfirm('');
    expect(component.list.patchVisibleItem).toHaveBeenCalledWith(expect.any(Function), saved);
    expect(component.list.removeVisibleItems).not.toHaveBeenCalled();
    component.category = 'event';
    await component.dialogs.open.mock.calls[0][0].onConfirm('');
    expect(component.list.removeVisibleItems).toHaveBeenCalledOnce();
  });
  it('does not change the visible list or counters after a failed save', async () => {
    const component = popup();
    component.service.decide.mockRejectedValue(new Error('unavailable'));
    component.decide({ id: 'rejected', context: original });
    await expect(component.dialogs.open.mock.calls[0][0].onConfirm('Reason')).rejects.toThrow('unavailable');
    expect(component.state.apply).not.toHaveBeenCalled();
    expect(component.list.removeVisibleItems).not.toHaveBeenCalled();
    expect(component.list.patchVisibleItem).not.toHaveBeenCalled();
  });
  it('reports a failed page load without replacing the stored counters and clears the error after retry', async () => {
    const component = popup();
    const query = { filters: { category: 'all', status: 'under-review' }, pageSize: 20 };
    component.service.page.mockRejectedValueOnce(new Error('unavailable'));
    await expect(component.load(query)).rejects.toThrow('unavailable');
    expect(component.error.set).toHaveBeenLastCalledWith(true);
    expect(component.state.apply).not.toHaveBeenCalled();
    const page = { items: [original], total: 1, snapshot: { revision: 1 } };
    component.service.page.mockResolvedValueOnce(page);
    await expect(component.load(query)).resolves.toEqual(page);
    expect(component.error.set).toHaveBeenLastCalledWith(false);
    expect(component.state.apply).toHaveBeenCalledWith(page.snapshot);
  });
  it('unblocks through confirmation into the Under review bucket', () => {
    const component = popup();
    component.decide({ id: 'under-review', context: { ...original, status: 'blocked' } });
    expect(component.dialogs.open.mock.calls[0][0].title).toBe('moderation.unblock');
    expect(component.service.decide).not.toHaveBeenCalled();
  });
  it('offers rejection for unapproved content and blocking only after public approval', () => {
    const component = popup();
    component.decide({ id: 'blocked', context: original });
    expect(component.dialogs.open).not.toHaveBeenCalled();
    component.decide({ id: 'rejected', context: original });
    expect(component.dialogs.open).toHaveBeenCalledOnce();
    component.dialogs.open.mockClear();
    const reviewed = { ...original, publiclyVisibleOnce: true };
    component.decide({ id: 'rejected', context: reviewed });
    expect(component.dialogs.open).not.toHaveBeenCalled();
    component.decide({ id: 'blocked', context: reviewed });
    expect(component.dialogs.open).toHaveBeenCalledOnce();
  });

});
