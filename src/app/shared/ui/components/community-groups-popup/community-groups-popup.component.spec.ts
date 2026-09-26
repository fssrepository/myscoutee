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
    query: { filters: { bucket, category } },
    store: { counters: () => ({ hosting: 5, participation: 5 }), categoryCount: counts.categoryCount.bind(counts) }
  });
  return component.model();
}

describe('Group selector counters', () => {
  it('sums operations in a category instead of counting matching groups', () => {
    expect(workspace().categoryCount('hosting', 'friends')).toBe(5);
    expect(workspace().categoryCount('hosting', 'work')).toBe(0);
    expect(workspace().categoryCount('participation', null)).toBe(5);
  });
  it('includes pending participation while keeping it out of Hosting', () => {
    expect(workspace().categoryCount('participation', 'work')).toBe(1);
    expect(workspace().categoryCount('hosting', 'work')).toBe(0);
  });
  it('explicitly disables automatic alert aggregation on Explore', () => {
    const controls = model('explore').toolbarControls;
    expect(controls[0].trigger.counter).toBe(0);
    expect(controls[0].items.find((item: { id: string }) => item.id === 'explore').counter).toBe(0);
    expect(controls[1].trigger.counter).toBe(0);
    expect(controls[1].items.every((item: { counter: number }) => item.counter === 0)).toBe(true);
  });
  it('supplies the selected category total and individual red category counters', () => {
    const controls = model('hosting', 'friends').toolbarControls;
    expect(controls[0].trigger.counter).toBe(5);
    expect(controls[1].trigger.counter).toBe(5);
    expect(controls[1].items.find((item: { id: string }) => item.id === 'friends')).toMatchObject({ counter: 5, counterTone: 'alert' });
  });
  it('uses the common Event distance grouping with a genuine zero-distance bucket', () => {
    const labels = { dateUnavailable: '', weekPrefix: '' };
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 0 }, 'distance', labels)).toBe('0 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 3200 }, 'distance', labels)).toBe('5 km');
    expect(AppUtils.activityGroupLabel({ distanceMetersExact: 5100 }, 'distance', labels)).toBe('10 km');
  });
});
