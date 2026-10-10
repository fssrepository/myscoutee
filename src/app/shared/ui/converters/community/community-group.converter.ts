import { AppUtils } from '../../../core/base/app-utils';
import { canPreviewGroupMembers, communityGroupSummary, groupMembershipBucket, type CommunityGroupSummary, type GroupBucket, type GroupVisibility, type GroupCategory } from '../../../core/contracts/community-group.interface';
import {
  type InfoCardData,
  type InfoCardOverlayAction,
  type InfoCardOverlayTone,
  type AppMenuItem,
  type AppMenuPalette,
  appMenuAlertCounter,
  appMenuResolveLiveValue,
  CARD_MENU_ACTIONS
} from '@fssrepository/myscoutee-components';

import { contentModerationBadge } from '../content/content-moderation-badge';
import { ActivityEventInfoCardMenuConverter } from '../event/activity-event-info-card-menu.converter';

import { baseGroupType } from '../../../core/contracts/group-type';
import { GROUP_TYPE_STYLES, groupTypeTrigger } from './group-type-menu';
export const GROUP_BUCKET_STYLE: Record<GroupBucket, { icon: string; palette: AppMenuPalette; tone: InfoCardOverlayTone }> = {
  hosting: { icon: 'event_seat', palette: 'green', tone: 'stage-finalized' }, participation: { icon: 'groups', palette: 'orange', tone: 'orange' },
  invitations: { icon: 'mail', palette: 'violet', tone: 'purple' },
  pending: { icon: 'pending_actions', palette: 'amber', tone: 'stage-review' },
  trash: { icon: 'delete', palette: 'danger', tone: 'danger' },
  explore: { icon: 'explore', palette: 'violet', tone: 'purple' }
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
const GROUP_CATEGORY_HUE: Record<GroupCategory, number> = {
  friends: 175, work: 215, sport: 28, learning: 265, hobbies: 340, neighbourhood: 140
};
export class CommunityGroupConverter {
  static card(group: CommunityGroupSummary, translate: (key: string) => string): InfoCardData<CommunityGroupSummary> {
    const baseType = baseGroupType(group.id);
    const main = baseType ? groupTypeTrigger(baseType) : null;
    const title = main ? translate(main.label) : group.name;
    const membersVisible = canPreviewGroupMembers(group);
    const menuCounter = appMenuAlertCounter(this.menu(group));
    const menuBadgeCount = Number(appMenuResolveLiveValue(
      menuCounter && typeof menuCounter === 'object' ? menuCounter.value : menuCounter
    )) || 0;
    return { id: group.id, smartListKey: `community:${group.id}`, ownerId: group.ownerUserId, ownerUserId: group.ownerUserId,
      title, dateIso: group.updatedAtIso, imageUrl: group.imageUrl, mediaFit: 'contain',
      placeholderLabel: group.imageUrl ? null : title,
      groupLabel: main ? translate('groups.base') : group.distanceKm == null ? translate('groups.title') : AppUtils.activityGroupLabel({ distanceMetersExact: group.distanceKm * 1000 }, 'distance', { dateUnavailable: '', weekPrefix: '' }),
      distanceMetersExact: group.distanceKm == null ? undefined : group.distanceKm * 1000,
      metaRows: [translate(main ? 'groups.base' : `groups.category.${group.category}`), ...(group.distanceKm == null ? [] : [`${group.distanceKm} km`])],
      leadingIcon: main ? { icon: main.icon, palette: main.palette } : { icon: GROUP_CATEGORY_ICON[group.category], palette: GROUP_CATEGORY_PALETTE[group.category] },
      surfaceTone: 'subevent-light', accentHue: baseType ? GROUP_TYPE_STYLES[baseType].accentHue : GROUP_CATEGORY_HUE[group.category],
      mediaStart: { variant: 'badge', layout: 'avatar-metric', tone: 'cool',
        leadingAccessory: { label: AppUtils.initialsFromText(group.ownerName), tone: 'default' },
        ariaLabel: group.ownerName, interactive: true },
      mediaBottomStart: this.statusBadge(group),
      mediaEnd: { variant: 'badge', layout: 'badge-with-leading-accessory', label: `${group.acceptedMembers}`,
        ariaLabel: membersVisible ? 'open.members' : 'groups.member.list',
        interactive: membersVisible, disabled: !membersVisible,
        tone: membersVisible ? 'default' : 'inactive',
        leadingAccessory: { icon: membersVisible ? 'groups' : 'visibility_off', tone: membersVisible ? 'positive' : 'negative' },
        pendingCount: membersVisible ? group.membersActivity ?? group.pendingMembers : 0 },
      hasMenuOptions: this.menu(group).length > 0, menuBadgeCount, clickable: false, state: 'default', eagerDetail: communityGroupSummary(group) };
  }
  private static statusBadge(group: CommunityGroupSummary): InfoCardOverlayAction {
    if (group.lifecycleStatus === 'deleted' || group.membershipStatus === 'deleted')
      return { variant: 'badge', tone: 'danger', icon: 'delete', label: 'deleted', ariaLabel: 'deleted', interactive: false };
    if (group.membershipStatus === 'blocked')
      return { variant: 'badge', tone: 'danger', icon: 'block', label: 'blocked', ariaLabel: 'blocked', interactive: false };
    const moderation = contentModerationBadge(group.moderationStatus)
      ?? (group.lifecycleStatus === 'under-review' ? contentModerationBadge('under-review') : null);
    if (moderation) return moderation;
    const bucket = groupMembershipBucket(group), style = GROUP_BUCKET_STYLE[bucket];
    const label = bucket === 'invitations' ? 'Invitations' : `groups.bucket.${bucket}`;
    return { variant: 'badge', tone: style.tone, icon: style.icon, label, ariaLabel: label, interactive: false };
  }
  static menu(group: CommunityGroupSummary, userId?: string | null): AppMenuItem[] {
    if ((group.membershipStatus === 'deleted' || group.membershipStatus === 'blocked')) return group.lifecycleStatus === 'deleted' && !group.canRestoreGroup ? [] : [{
      id: 'restore', label: 'restore', icon: CARD_MENU_ACTIONS['restore'].icon,
      palette: ActivityEventInfoCardMenuConverter.actionPalette('restore', CARD_MENU_ACTIONS['restore'].tone), surface: 'tinted', context: group
    }];
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
