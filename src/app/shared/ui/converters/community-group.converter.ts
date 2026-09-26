import { AppUtils } from '../../app-utils';
import { canPreviewGroupMembers, communityGroupSummary, type CommunityGroupSummary, type GroupBucket, type GroupVisibility, type GroupCategory } from '../../core/contracts/community-group.interface';
import type { InfoCardData } from '../components/core/smart-list/card';
import type { AppMenuItem, AppMenuPalette } from '../components/core/menu';
import { appMenuAlertCounter, appMenuResolveLiveValue } from '../components/core/menu';
import { contentModerationBadge } from './content-moderation-badge';
import { ActivityEventInfoCardMenuConverter } from './activity-event-info-card-menu.converter';
import { CARD_MENU_ACTIONS } from '../components/core/smart-list/card';
export const GROUP_BUCKET_STYLE: Record<GroupBucket, { icon: string; palette: AppMenuPalette }> = {
  hosting: { icon: 'event_seat', palette: 'green' }, participation: { icon: 'groups', palette: 'orange' },
  invitations: { icon: 'mail', palette: 'violet' },
  pending: { icon: 'pending_actions', palette: 'amber' },
  explore: { icon: 'explore', palette: 'violet' }
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
    const membersVisible = canPreviewGroupMembers(group);
    const menuCounter = appMenuAlertCounter(this.menu(group));
    const menuBadgeCount = Number(appMenuResolveLiveValue(
      menuCounter && typeof menuCounter === 'object' ? menuCounter.value : menuCounter
    )) || 0;
    return { id: group.id, smartListKey: `community:${group.id}`, ownerId: group.ownerUserId, ownerUserId: group.ownerUserId,
      title: group.name, dateIso: group.updatedAtIso, imageUrl: group.imageUrl, mediaFit: 'contain',
      placeholderLabel: group.imageUrl ? null : group.name,
      groupLabel: group.distanceKm == null ? translate('groups.title') : AppUtils.activityGroupLabel({ distanceMetersExact: group.distanceKm * 1000 }, 'distance', { dateUnavailable: '', weekPrefix: '' }),
      distanceMetersExact: group.distanceKm == null ? undefined : group.distanceKm * 1000,
      metaRows: [translate(`groups.category.${group.category}`), ...(group.distanceKm == null ? [] : [`${group.distanceKm} km`])],
      leadingIcon: { icon: GROUP_CATEGORY_ICON[group.category], palette: GROUP_CATEGORY_PALETTE[group.category] },
      surfaceTone: group.membershipStatus === 'pending' ? 'pending' : group.role === 'Admin' ? 'published' : 'default',
      mediaStart: { variant: 'avatar', imageUrl: group.ownerAvatarUrl, label: AppUtils.initialsFromText(group.ownerName),
        ariaLabel: group.ownerName, interactive: true },
      mediaBottomStart: contentModerationBadge(group.moderationStatus),
      mediaEnd: { variant: 'badge', layout: 'badge-with-leading-accessory', label: `${group.acceptedMembers}`,
        ariaLabel: membersVisible ? 'open.members' : 'groups.member.list',
        interactive: membersVisible, disabled: !membersVisible,
        tone: membersVisible ? 'default' : 'inactive',
        leadingAccessory: { icon: membersVisible ? 'groups' : 'visibility_off', tone: membersVisible ? 'positive' : 'negative' },
        pendingCount: membersVisible ? group.membersActivity ?? group.pendingMembers : 0 },
      hasMenuOptions: true, menuBadgeCount, clickable: false, state: 'default', eagerDetail: communityGroupSummary(group) };
  }
  static menu(group: CommunityGroupSummary, userId?: string | null): AppMenuItem[] {
    const items: AppMenuItem[] = [{ id: 'view', label: 'view', icon: 'visibility', palette: ActivityEventInfoCardMenuConverter.actionPalette('view', CARD_MENU_ACTIONS['view'].tone), surface: 'tinted', context: group }];
    if (group.lifecycleStatus !== 'under-review' && group.role === 'Admin' && group.membershipStatus === 'accepted') {
      items.push({ id: 'share', label: 'invite.external.title', icon: 'share', palette: 'teal', surface: 'tinted', context: group });
      items.push({ id: 'edit', label: 'edit', icon: 'edit', palette: ActivityEventInfoCardMenuConverter.actionPalette('edit', CARD_MENU_ACTIONS['edit'].tone), surface: 'tinted', context: group });
      items.push({ id: 'moderation', label: 'moderation.title', icon: 'fact_check', palette: 'lime', surface: 'tinted',
        counter: { value: group.moderationPending ?? 0, max: 99 }, counterTone: 'alert', context: group });
    } else if (group.lifecycleStatus !== 'under-review' && !group.membershipStatus && (!group.moderationStatus || group.moderationStatus === 'accepted')) {
      items.push({ id: 'join', label: 'groups.join', icon: 'person_add', palette: 'blue', surface: 'tinted', context: group });
    } else if (group.membershipStatus === 'pending' && group.requestKind === 'invite') {
      items.push({ id: 'accept', label: 'accept', icon: 'done', palette: ActivityEventInfoCardMenuConverter.actionPalette('accept', CARD_MENU_ACTIONS['accept'].tone), surface: 'tinted', context: group });
    }
    if (group.canTakeOver) items.push({ id: 'take-over', label: 'groups.takeover', icon: 'verified_user', palette: 'warning', surface: 'tinted', context: group });
    if (group.membershipStatus === 'accepted') items.push({ id: 'remove', label: 'groups.leave', icon: 'logout', palette: 'danger', surface: 'tinted', context: group });
    if (userId && userId !== group.ownerUserId) items.push({ id: 'report', label: 'groups.report', icon: 'flag', palette: ActivityEventInfoCardMenuConverter.actionPalette('reportOrganizer', CARD_MENU_ACTIONS['reportOrganizer'].tone), surface: 'tinted', context: group });
    return items;
  }
}
