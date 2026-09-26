import { TestBed } from '@angular/core/testing';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import type { GroupWorkspace } from '../../../core/contracts/community-group.interface';
import { AssetStore } from './asset.store';
import { ActivityStore } from './activity.store';

const workspace = (id: string): GroupWorkspace => ({groupId: id, profileId: `profile-${id}`,
  name: id, role: 'Member', activity: 0, policy: {workspace: true, enabled: false, requiredFields: []}});

describe('Account-owned tools in group workspaces', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('retains the asset owner and open tools popup when switching groups or returning to Base', () => {
    const context = TestBed.inject(GroupWorkspaceContextService);
    const assets = TestBed.inject(AssetStore);
    context.accountUserId.set('account');
    assets.setActiveOwnerUserId('account');
    assets.openAssetPopup('Supplies');
    for (const group of ['a', 'b']) {
      context.active.set(workspace(group));
      expect(assets.setActiveOwnerUserId(`profile-${group}`)).toBe(false);
      expect(assets.activeOwnerUserId()).toBe('account');
      expect(assets.isActiveOwnerUser(`profile-${group}`)).toBe(true);
      expect(assets.activePopupFilter()).toBe('Supplies');
    }
    context.active.set(null);
    expect(assets.setActiveOwnerUserId('account')).toBe(false);
    expect(assets.activeOwnerUserId()).toBe('account');
  });

  it('shares tool badges immediately while event counters stay separate, and rejects an older poll', () => {
    const context = TestBed.inject(GroupWorkspaceContextService);
    const activity = TestBed.inject(ActivityStore);
    context.accountUserId.set('account');
    activity.patchUserCounterOverrides('account', {supplies: 4, events: 1});
    context.active.set(workspace('a'));
    activity.patchUserCounterOverrides('profile-a', {supplies: 4, events: 10});
    const beforeEdit = activity.captureUserCounterSyncToken('profile-a');
    activity.signalUserAssetBucketCount('account', 'Supplies', 5);
    expect(activity.getUserCounterOverrides('profile-a')).toMatchObject({supplies: 5, events: 10, asset: {supplies: 5}});
    expect(activity.applyRealtimeCounterOverrides(beforeEdit, {supplies: 4})).toBe(false);
    context.active.set(workspace('b'));
    activity.patchUserCounterOverrides('profile-b', {events: 20});
    expect(activity.getUserCounterOverrides('profile-b')).toMatchObject({supplies: 5, events: 20});
    context.active.set(null);
    expect(activity.getUserCounterOverrides('account')).toMatchObject({supplies: 5, events: 1});
  });

  it('uses incoming group poll tool counts for the account and keeps another account isolated', () => {
    const context = TestBed.inject(GroupWorkspaceContextService);
    const activity = TestBed.inject(ActivityStore);
    context.accountUserId.set('account'); context.active.set(workspace('a'));
    const poll = activity.captureUserCounterSyncToken('profile-a');
    expect(activity.applyRealtimeCounterOverrides(poll, {supplies: 7, contacts: 3, contactRequestsPending: 2})).toBe(true);
    expect(activity.getUserCounterOverrides('account')).toMatchObject({supplies: 7, contacts: 3, contactRequestsPending: 2});
    expect(activity.getUserCounterOverrides('stranger')).toEqual({});
    activity.clearUserCounterOverrides('profile-a', ['supplies']);
    expect(activity.getUserCounterOverride('account', 'supplies')).toBeNull();
  });
});
