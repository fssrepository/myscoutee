import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { EventExplorePopupComponent } from '../event-explore-popup/event-explore-popup.component';
import { ActivitiesPopupComponent } from '../activities-popup/activities-popup.component';
import { EventMembersPopupComponent } from './event-members-popup.component';
import { PhotoFeedPopupComponent } from '../../../shared/ui/components/photo-feed-popup/photo-feed-popup.component';
import { FollowingStore } from '../../../shared/ui/context/stores/following.store';

const member = { id: 'organizer', userId: 'organizer', name: 'Organizer', status: 'accepted' };
function setup(surface: string, followed = false) {
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const pending = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const dialogStore = new DialogStore();
  const list = { closeMenu: vi.fn(), itemsSnapshot: () => [member], replaceVisibleItems: vi.fn() };
  const host: any = {
    dialogStore, followingStore: { change: vi.fn(() => pending) }, cdr: { markForCheck: vi.fn() },
    appMenuDispatcher: { close: vi.fn() }, activitiesSmartList: list,
    activityEventDTOFromVisibleSource: () => ({ creatorName: 'Organizer' }),
    membersCacheByOwnerId: new Map([['owner', [member]]]), membersCacheKey: () => 'owner', ownerId: 'owner',
    membersListReady: true, membersSmartList: list, selectedMembersVisible: [member], pendingOnly: false,
    syncCanManageMembers: vi.fn(), applySummaryFromMembers: vi.fn(), emitResourceMemberDelta: vi.fn()
  };
  host.syncVisibleMembers = (previous: any[], next: any[]) =>
    (EventMembersPopupComponent.prototype as any).syncVisibleMembers.call(host, previous, next);
  host.applyCommittedMembers = (next: any[], previous: any[]) =>
    (EventMembersPopupComponent.prototype as any).applyCommittedMembers.call(host, next, previous);
  host.followingStore.dialogStore = dialogStore;
  host.followingStore.confirmChange = (...args: Parameters<FollowingStore['confirmChange']>) =>
    FollowingStore.prototype.confirmChange.apply(host.followingStore, args);
  host.followingStore.state = () => ({ organizerIds: followed ? [] : ['organizer'] });
  host.store = { userId: () => 'viewer' };
  if (surface === 'Explore') (EventExplorePopupComponent.prototype as any).changeOrganizerFollow.call(host,
    { creatorUserId: 'organizer', creatorName: 'Organizer' }, followed);
  if (surface === 'Activities') (ActivitiesPopupComponent.prototype as any).changeActivityOrganizerFollow.call(host,
    'organizer', { id: 'event' }, followed);
  if (surface === 'Members') (EventMembersPopupComponent.prototype as any).onMemberActionMenuSelect.call(host,
    { context: { menu: 'member-action', action: 'unfollow', member } });
  if (surface === 'Feed') (PhotoFeedPopupComponent.prototype as any).onMenuSelect.call(host,
    { id: 'follow-organizer', context: { organizerId: 'organizer', organizerName: 'Organizer' } });
  return { host, dialogStore, list, finish, fail };
}

describe.each(['Explore', 'Activities', 'Members', 'Feed'])('%s following confirmation', surface => {
  it('does not persist on open or cancel', () => {
    const { host, dialogStore } = setup(surface);
    expect(dialogStore.dialog()?.title).toBe('event.following.unfollow');
    dialogStore.cancel();
    expect(host.followingStore.change).not.toHaveBeenCalled();
  });
  it('awaits persistence, suppresses duplicate confirmation, then commits the UI', async () => {
    const { host, dialogStore, list, finish } = setup(surface);
    const saving = dialogStore.confirm();
    expect(dialogStore.dialog()?.busy).toBe(true);
    expect(list.replaceVisibleItems).not.toHaveBeenCalled();
    await dialogStore.confirm();
    expect(host.followingStore.change).toHaveBeenCalledTimes(1);
    expect(host.followingStore.change).toHaveBeenCalledWith('organizer', false);
    finish(); await saving;
    expect(dialogStore.dialog()).toBeNull();
    if (surface === 'Members') expect(list.replaceVisibleItems).toHaveBeenCalledWith([], { total: 0 });
  });
  it('retains the member/list when saving fails', async () => {
    const { dialogStore, list, fail } = setup(surface);
    const saving = dialogStore.confirm();
    fail(new Error('Save failed')); await saving;
    expect(dialogStore.dialog()).toMatchObject({ busy: false, errorMessage: 'Save failed' });
    expect(list.replaceVisibleItems).not.toHaveBeenCalled();
  });
});

it.each(['Explore', 'Activities', 'Feed'])('%s follow also waits for confirmation', async surface => {
  const { dialogStore, host, finish } = setup(surface, true);
  expect(dialogStore.dialog()?.title).toBe('event.following.follow');
  expect(host.followingStore.change).not.toHaveBeenCalled();
  const saving = dialogStore.confirm();
  expect(host.followingStore.change).toHaveBeenCalledWith('organizer', true);
  finish(); await saving;
});
