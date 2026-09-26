import { describe, expect, it, vi } from 'vitest';
import type { CommunityGroupSummary } from '../../core/contracts/community-group.interface';
import { CommunityGroupConverter } from './community-group.converter';
import { CommunityGroupsStore } from '../context/stores/community-groups.store';

const group = (patch: Partial<CommunityGroupSummary> = {}): CommunityGroupSummary => ({
  id: 'group', ownerUserId: 'organizer', ownerName: 'Organizer', ownerAvatarUrl: null,
  name: 'Private roster', imageUrl: null, category: 'friends', visibility: 'invitation',
  hideMembers: true, createdAtIso: '', updatedAtIso: '', version: 1,
  role: 'Member', membershipStatus: 'pending', requestKind: 'invite', organizerOnly: false,
  acceptedMembers: 2, pendingMembers: 1, activity: 1, distanceKm: 0, ...patch
});

describe('Group member badge access', () => {
  it.each([
    { role: null, membershipStatus: null, requestKind: null },
    { role: 'Member', membershipStatus: 'accepted', requestKind: null },
    { role: 'Member', membershipStatus: 'pending', requestKind: 'invite' },
    { role: 'Admin', membershipStatus: 'pending', requestKind: 'invite' }
  ] as Partial<CommunityGroupSummary>[])('disables a hidden roster for $role/$membershipStatus', patch => {
    const dto = group(patch);
    const card = CommunityGroupConverter.card(dto, key => key);
    expect(card.mediaEnd).toMatchObject({ disabled: true, interactive: false, pendingCount: 0,
      leadingAccessory: { icon: 'visibility_off' } });
    expect(card.mediaEnd?.shape).toBeUndefined();
    expect(card.mediaEnd?.tone).toBe('inactive');
    expect(card.mediaEnd?.layout).toBe('badge-with-leading-accessory');
    const requestActivitiesNavigation = vi.fn();
    const store = Object.assign(Object.create(CommunityGroupsStore.prototype), { memberMenu: { requestActivitiesNavigation } });
    store.members(dto);
    expect(requestActivitiesNavigation).not.toHaveBeenCalled();
  });
  it('retains administrator access and its pending decisions', () => {
    expect(CommunityGroupConverter.card(group({ role: 'Admin', membershipStatus: 'accepted' }), key => key).mediaEnd)
      .toMatchObject({ disabled: false, interactive: true, pendingCount: 1 });
  });
  it('retains visible roster access', () => {
    expect(CommunityGroupConverter.card(group({ hideMembers: false }), key => key).mediaEnd)
      .toMatchObject({ disabled: false, interactive: true, pendingCount: 1 });
  });
  it('keeps accepting a private-roster invitation on the card, without a duplicate Members item', () => {
    const dto = group();
    const menu = CommunityGroupConverter.menu(dto, 'invitee');
    expect(menu.some(item => item.id === 'accept')).toBe(true);
    expect(menu.some(item => item.id === 'members')).toBe(false);
    expect(CommunityGroupConverter.card(dto, key => key).menuBadgeCount).toBe(0);
    expect(CommunityGroupConverter.card(dto, key => key).eagerDetail?.activity).toBe(1);
  });
  it('sums only counters in the card menu, independently from member and group totals', () => {
    const dto = group({ role: 'Admin', membershipStatus: 'accepted', moderationPending: 3, activity: 7 });
    const card = CommunityGroupConverter.card(dto, key => key);
    expect(card.menuBadgeCount).toBe(3);
    expect(card.mediaEnd?.pendingCount).toBe(1);
    expect(card.eagerDetail?.activity).toBe(7);
  });
  it('puts unread member changes and pending decisions together on the accessible member badge', () => {
    const dto = group({ hideMembers: false, membershipStatus: 'accepted', membersActivity: 4, pendingMembers: 1 });
    const card = CommunityGroupConverter.card(dto, key => key);
    expect(card.mediaEnd?.pendingCount).toBe(4);
    expect(card.menuBadgeCount).toBe(0);
  });
});
