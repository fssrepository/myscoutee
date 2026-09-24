import { AppUtils } from '../../app-utils';
import type { CommunityGroup, GroupBucket, GroupVisibility, GroupCategory } from '../../core/contracts/community-group.interface';
import type { InfoCardData } from '../components/core/smart-list/card';
import type { AppMenuItem, AppMenuPalette } from '../components/core/menu';
export const GROUP_BUCKET_STYLE: Record<GroupBucket, { icon: string; palette: AppMenuPalette }> = {
  hosting: { icon: 'event_seat', palette: 'blue' }, participation: { icon: 'groups', palette: 'violet' },
  explore: { icon: 'explore', palette: 'teal' }
};
export const GROUP_VISIBILITY_STYLE: Record<GroupVisibility, { icon: string; palette: AppMenuPalette }> = {
  public: { icon: 'public', palette: 'green' }, private: { icon: 'lock', palette: 'blue' },
  invitation: { icon: 'mail_lock', palette: 'amber' }
};
export const GROUP_CATEGORY_ICON: Record<GroupCategory, string> = {
  friends: 'diversity_3', work: 'work', sport: 'sports', learning: 'school', hobbies: 'palette', neighbourhood: 'location_city'
};
export const GROUP_CATEGORY_PALETTE: Record<GroupCategory, AppMenuPalette> = {
  friends: 'teal', work: 'blue', sport: 'orange', learning: 'violet', hobbies: 'rose', neighbourhood: 'green'
};
export class CommunityGroupConverter {
  static card(group: CommunityGroup, translate: (key: string) => string): InfoCardData<CommunityGroup> {
    return { id: group.id, smartListKey: `community:${group.id}`, ownerId: group.ownerUserId, ownerUserId: group.ownerUserId,
      title: group.name, dateIso: group.createdAtIso, imageUrl: group.imageUrl,
      placeholderLabel: group.imageUrl ? null : group.name, description: group.description, descriptionLines: 2,
      groupLabel: group.distanceKm == null ? translate('groups.title') : AppUtils.activityGroupLabel({ distanceMetersExact: group.distanceKm * 1000 }, 'distance', { dateUnavailable: '', weekPrefix: '' }),
      distanceMetersExact: group.distanceKm == null ? undefined : group.distanceKm * 1000,
      metaRows: [translate(`groups.category.${group.category}`), ...(group.distanceKm == null ? [] : [`${group.distanceKm} km`])],
      leadingIcon: { icon: GROUP_CATEGORY_ICON[group.category] },
      surfaceTone: group.membershipStatus === 'pending' ? 'pending' : group.role === 'Admin' ? 'published' : 'default',
      mediaStart: { variant: 'avatar', imageUrl: group.ownerAvatarUrl, label: AppUtils.initialsFromText(group.ownerName),
        ariaLabel: group.ownerName, interactive: true },
      mediaEnd: { variant: 'badge', shape: 'circle', label: `${group.acceptedMembers}`, ariaLabel: 'open.members',
        interactive: true, pendingCount: group.pendingMembers },
      hasMenuOptions: true, menuBadgeCount: group.activity, clickable: false, state: 'default', eagerDetail: group };
  }
  static menu(group: CommunityGroup): AppMenuItem[] {
    const items: AppMenuItem[] = [{ id: 'view', label: 'view', icon: 'visibility', palette: 'blue', surface: 'tinted', context: group },
      { id: 'members', label: 'members', icon: 'groups', palette: 'violet', surface: 'tinted', context: group }];
    if (group.role === 'Admin' && group.membershipStatus === 'accepted') {
      items.push({ id: 'edit', label: 'edit', icon: 'edit', palette: 'teal', surface: 'tinted', context: group });
      items.push({ id: group.organizerOnly ? 'set-participant' : 'set-organizer-only',
        label: group.organizerOnly ? 'groups.participate' : 'groups.organizer.only',
        icon: group.organizerOnly ? 'person_add' : 'person_off', palette: 'amber', surface: 'tinted', context: group });
    } else if (!group.membershipStatus) {
      items.push({ id: 'join', label: 'groups.join', icon: 'group_add', palette: 'success', surface: 'tinted', context: group });
    } else if (group.membershipStatus === 'pending' && group.requestKind === 'invite') {
      items.push({ id: 'accept', label: 'accept', icon: 'check', palette: 'success', surface: 'tinted', context: group });
    }
    return items;
  }
}
