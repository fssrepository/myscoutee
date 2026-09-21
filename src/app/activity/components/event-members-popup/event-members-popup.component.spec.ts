import { EventMembersPopupComponent } from './event-members-popup.component';

describe('Event member popup mode isolation', () => {
  function popup() {
    const component = Object.create(EventMembersPopupComponent.prototype);
    Object.assign(component, { mingleLive: true, mingleStore: { closeLiveView: vi.fn() },
      membersListPollScheduler: { destroy: vi.fn() }, canManageMembers: false });
    return component;
  }

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
});
