import { EventMembersPopupComponent } from './event-members-popup.component';

describe('Event member popup mode isolation', () => {
  function popup() {
    const component = Object.create(EventMembersPopupComponent.prototype);
    Object.assign(component, { mingleLive: true, mingleStore: { closeLiveView: vi.fn(), countdown: () => '9:23', state: vi.fn(() => ({ status: 'ROUND' })) },
      membersListPollScheduler: { destroy: vi.fn() }, canManageMembers: false });
    return component;
  }

  it('shows only the countdown in the shared header badge, with the phase tone', () => {
    const component = popup();
    expect(component.membersPopupModel()).toMatchObject({ headerBadge: '9:23', headerBadgeTone: 'neutral' });
    expect(component.membersPopupModel().secondarySubtitle).toBeUndefined();
    component.mingleStore.state.mockReturnValue({ status: 'PAUSED' });
    expect(component.membersPopupModel().headerBadgeTone).toBe('warning');
    component.mingleStore.state.mockReturnValue({ status: 'BREAK' });
    expect(component.membersPopupModel().headerBadgeTone).toBe('warning');
    component.setMingleLive(false);
    expect(component.membersPopupModel()).toMatchObject({ headerBadge: null, headerBadgeTone: 'neutral' });
  });

  it('leaves the live table context when an ordinary member list replaces it', () => {
    const component = popup();
    component.setMingleLive(false);
    expect(component.mingleLive).toBe(false);
    expect(component.mingleStore.closeLiveView).toHaveBeenCalledTimes(1);
    component.setMingleLive(false);
    expect(component.mingleStore.closeLiveView).toHaveBeenCalledTimes(1);
  });

  it('stops the live table clock when the member popup is destroyed', () => {
    const component = popup();
    component.ngOnDestroy();
    expect(component.mingleStore.closeLiveView).toHaveBeenCalledTimes(1);
    expect(component.membersListPollScheduler.destroy).toHaveBeenCalledTimes(1);
  });

  it('preserves the pending filter for ordinary participants and hides it only in a read-only live table', () => {
    const component = popup();
    const actionIds = () => component.membersPopupModel().toolbarControls.map((action: { id: string }) => action.id);
    expect(actionIds()).not.toContain('pending-only');
    component.setMingleLive(false);
    expect(actionIds()).toContain('pending-only');
    component.setMingleLive(true);
    component.canManageMembers = true;
    expect(actionIds()).toContain('pending-only');
  });

  it('updates contact members in the current list without reloading or resetting the filter', () => {
    const component = popup();
    const first = { id: 'first', status: 'accepted' };
    const second = { id: 'second', status: 'accepted' };
    const replaceVisibleItems = vi.fn();
    const reload = vi.fn();
    Object.assign(component, { membersListReady: true, ownerId: 'contact-chat', lookupRef: { type: 'chat' },
      pendingOnly: false, selectedMembersVisible: [first],
      membersSmartList: { itemsSnapshot: () => [first], replaceVisibleItems, reload } });
    component.syncVisibleMembers([first], [first, second]);
    expect(replaceVisibleItems).toHaveBeenLastCalledWith([first, second], { total: 2 });
    component.pendingOnly = true;
    component.syncVisibleMembers([first], [first, second]);
    expect(replaceVisibleItems).toHaveBeenLastCalledWith([], { total: 0 });
    expect(component.pendingOnly).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
});
