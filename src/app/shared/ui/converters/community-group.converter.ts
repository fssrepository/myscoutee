import { AppUtils } from '../../app-utils';
import { communityGroupSummary, type CommunityGroupSummary, type GroupBucket, type GroupVisibility, type GroupCategory } from '../../core/contracts/community-group.interface';
import type { InfoCardData } from '../components/core/smart-list/card';
import type { AppMenuItem, AppMenuPalette } from '../components/core/menu';
import { contentModerationBadge } from './content-moderation-badge';
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
export const GROUP_CATEGORY_PALETTE = {
  friends: 'teal', work: 'blue', sport: 'orange', learning: 'violet', hobbies: 'rose', neighbourhood: 'green'
} as const satisfies Record<GroupCategory, AppMenuPalette>;
export class CommunityGroupConverter {
  static card(group: CommunityGroupSummary, translate: (key: string) => string): InfoCardData<CommunityGroupSummary> {
    return { id: group.id, smartListKey: `community:${group.id}`, ownerId: group.ownerUserId, ownerUserId: group.ownerUserId,
      title: group.name, dateIso: group.createdAtIso, imageUrl: group.imageUrl,
      placeholderLabel: group.imageUrl ? null : group.name,
      groupLabel: group.distanceKm == null ? translate('groups.title') : AppUtils.activityGroupLabel({ distanceMetersExact: group.distanceKm * 1000 }, 'distance', { dateUnavailable: '', weekPrefix: '' }),
      distanceMetersExact: group.distanceKm == null ? undefined : group.distanceKm * 1000,
      metaRows: [translate(`groups.category.${group.category}`), ...(group.distanceKm == null ? [] : [`${group.distanceKm} km`])],
      leadingIcon: { icon: GROUP_CATEGORY_ICON[group.category], palette: GROUP_CATEGORY_PALETTE[group.category] },
      surfaceTone: group.membershipStatus === 'pending' ? 'pending' : group.role === 'Admin' ? 'published' : 'default',
      mediaStart: { variant: 'avatar', imageUrl: group.ownerAvatarUrl, label: AppUtils.initialsFromText(group.ownerName),
        ariaLabel: group.ownerName, interactive: true },
      mediaBottomStart: contentModerationBadge(group.moderationStatus),
      mediaEnd: { variant: 'badge', shape: 'circle', label: `${group.acceptedMembers}`, ariaLabel: 'open.members',
        interactive: true, pendingCount: group.pendingMembers },
      hasMenuOptions: true, menuBadgeCount: group.activity, clickable: false, state: 'default', eagerDetail: communityGroupSummary(group) };
  }
  static menu(group: CommunityGroupSummary, userId?: string | null): AppMenuItem[] {
    const items: AppMenuItem[] = [{ id: 'view', label: 'view', icon: 'visibility', palette: 'blue', surface: 'tinted', context: group },
      { id: 'members', label: 'members', icon: 'groups', palette: 'violet', surface: 'tinted',
        counter: { value: group.membersActivity ?? 0, max: 99 }, counterTone: 'alert', context: group }];
    if (group.role === 'Admin' && group.membershipStatus === 'accepted') {
      items.push({ id: 'share', label: 'invite.external.title', icon: 'share', palette: 'teal', surface: 'tinted', context: group });
      items.push({ id: 'edit', label: 'edit', icon: 'edit', palette: 'teal', surface: 'tinted', context: group });
      items.push({ id: 'moderation', label: 'moderation.title', icon: 'fact_check', palette: 'lime', surface: 'tinted',
        counter: { value: group.moderationPending ?? 0, max: 99 }, counterTone: 'alert', context: group });
    } else if (!group.membershipStatus && (!group.moderationStatus || group.moderationStatus === 'accepted')) {
      items.push({ id: 'join', label: 'groups.join', icon: 'person_add', palette: 'blue', surface: 'tinted', context: group });
    } else if (group.membershipStatus === 'pending' && group.requestKind === 'invite') {
      items.push({ id: 'accept', label: 'accept', icon: 'done', palette: 'blue', surface: 'tinted', context: group });
    }
    if (userId && userId !== group.ownerUserId) items.push({ id: 'report', label: 'groups.report', icon: 'flag', palette: 'orange', surface: 'tinted', context: group });
    return items;
  }
}
