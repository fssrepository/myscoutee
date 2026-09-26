import { CommunityGroupsPopupComponent } from './community-groups-popup.component';
import { GroupWorkspaceStore } from '../../context/stores/group-workspace.store';
import { AppUtils } from '../../../app-utils';

const rows = [
  { groupId: 'a', category: 'friends', role: 'Admin', membershipStatus: 'accepted', activity: 2 },
  { groupId: 'b', category: 'friends', role: 'Admin', membershipStatus: 'accepted', activity: 3 },
  { groupId: 'c', category: 'work', role: 'Member', membershipStatus: 'pending', activity: 1 },
  { groupId: 'd', category: 'friends', role: 'Member', membershipStatus: 'accepted', activity: 4 }
];
function workspace() {
  return Object.assign(Object.create(GroupWorkspaceStore.prototype), { attentionRows: () => rows });
}
function model(bucket: string, category: string | null = null) {
  const counts = workspace();
  const component = Object.assign(Object.create(CommunityGroupsPopupComponent.prototype), {
    explore: bucket === 'explore',
    query: { filters: { bucket, category } },
    i18n: { translate: (key: string) => key },
    store: { counters: () => ({ hosting: 5, participation: 4, pending: 1, invitations: 0 }), categoryCount: counts.categoryCount.bind(counts) }
  });
  return component.model();
}

describe('Group selector counters', () => {
  it('offers only Distance and Recent, with contextual defaults', () => {
    for (const bucket of ['hosting', 'participation', 'pending', 'invitations', 'explore']) {
      const sort = model(bucket).headerControls.find((control: { id: string }) => control.id === 'sort');
      expect(sort.items.map((item: { label: string }) => item.label)).toEqual(['distance', 'recent']);
      expect(sort.items.find((item: { checked: boolean }) => item.checked).id)
        .toBe(bucket === 'explore' ? 'distance' : 'updated');
    }
  });
  it('sums operations in a category instead of counting matching groups', () => {
    expect(workspace().categoryCount('hosting', 'friends')).toBe(5);
    expect(workspace().categoryCount('hosting', 'work')).toBe(0);
    expect(workspace().categoryCount('participation', null)).toBe(4);
    expect(workspace().categoryCount('pending', null)).toBe(1);
  });
  it('separates pending requests from accepted membership and Hosting', () => {
    expect(workspace().categoryCount('participation', 'work')).toBe(0);
    expect(workspace().categoryCount('pending', 'work')).toBe(1);
    expect(workspace().categoryCount('hosting', 'work')).toBe(0);
  });
  it('keeps category filtering only in the separate Explore popup, with no red aggregates', () => {
    const explore = model('explore');
    expect(explore.title).toBe('groups.explore');
    expect(explore.toolbarControls.map((control: { id: string }) => control.id)).toEqual(['category']);
    expect(explore.toolbarControls[0].trigger.counter).toBe(0);
    expect(explore.toolbarControls[0].items.every((item: { counter: number }) => item.counter === 0)).toBe(true);
    expect(model('hosting').toolbarControls.map((control: { id: string }) => control.id)).toEqual(['bucket', 'actions']);
  });
  it('mirrors Event palettes and moves Explore into the plus action menu', () => {
    const controls = model('hosting').toolbarControls;
    expect(controls[0].items.map((item: { id: string; palette: string }) => [item.id, item.palette]))
      .toEqual([['hosting', 'green'], ['participation', 'orange'], ['pending', 'amber'], ['invitations', 'violet']]);
    expect(controls[1].trigger.icon).toBe('add');
    expect(controls[1].items.map((item: { id: string; palette: string }) => [item.id, item.palette]))
      .toEqual([['explore', 'violet'], ['create', 'green']]);
  });
  it('labels five-kilometre intervals by their inclusive lower boundary', () => {
    const labels = { dateUnavailable: '', weekPrefix: '' };
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 0 }, 'distance', labels)).toBe('0 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 3200 }, 'distance', labels)).toBe('0 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 4999 }, 'distance', labels)).toBe('0 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 5000 }, 'distance', labels)).toBe('5 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 5100 }, 'distance', labels)).toBe('5 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 9999 }, 'distance', labels)).toBe('5 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 10000 }, 'distance', labels)).toBe('10 km');
  });
});
