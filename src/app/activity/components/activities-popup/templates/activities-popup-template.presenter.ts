import type {
  ChatMenuItem,
  RateMenuItem
} from '../../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../../shared/core/base/interfaces/user.interface';
import type * as AppTypes from '../../../../shared/core/base/models';
import type {
  CardBadgeConfig,
  InfoCardData,
  InfoCardMenuAction,
  PairCardData,
  SingleCardData
} from '../../../../shared/ui';

import {
  buildActivitiesChatTemplateData,
  type ActivitiesChatTemplateData
} from './chat/activities-chat-template.builder';
import { buildActivitiesEventInfoCard } from './event/activities-event-template.builder';
import {
  buildActivitiesPairRateCard,
  buildActivitiesSingleRateCard,
  isActivitiesPairRateRow
} from './rate/activities-rate-template.builder';

interface ActivitiesPopupTemplatePresenterDeps {
  getActiveUser: () => DemoUser;
  getUsers: () => readonly DemoUser[];
  isFullscreenPaginationAnimating: () => boolean;
  getChatLastSender: (chat: ChatMenuItem) => DemoUser;
  getChatMemberCount: (chat: ChatMenuItem) => number;
  getChatChannelType: (chat: ChatMenuItem) => AppTypes.ChatChannelType;
  getActivityImageUrl: (row: AppTypes.ActivityListRow) => string | null;
  getActivityRowIdentity: (row: AppTypes.ActivityListRow) => string;
  getActivityCalendarDateRange: (row: AppTypes.ActivityListRow) => { start: Date; end: Date } | null;
  isActivityDraft: (row: AppTypes.ActivityListRow) => boolean;
  isPendingActivityRow: (row: AppTypes.ActivityListRow) => boolean;
  isActivityFull: (row: AppTypes.ActivityListRow) => boolean;
  getActivityLeadingIcon: (row: AppTypes.ActivityListRow) => string;
  getActivityLeadingIconTone: (row: AppTypes.ActivityListRow) => NonNullable<InfoCardData['leadingIcon']>['tone'];
  shouldShowActivitySourceIcon: (row: AppTypes.ActivityListRow) => boolean;
  getActivitySourceAvatarTone: (row: AppTypes.ActivityListRow) => NonNullable<InfoCardData['mediaStart']>['tone'] | null | undefined;
  getActivitySourceAvatarLabel: (row: AppTypes.ActivityListRow) => string;
  getActivityCapacityLabel: (row: AppTypes.ActivityListRow) => string;
  getActivityPendingMemberCount: (row: AppTypes.ActivityListRow) => number;
  getActivityEventInfoCardMenuActions: (row: AppTypes.ActivityListRow) => readonly InfoCardMenuAction[];
  getDisplayedRateDirection: (item: RateMenuItem) => RateMenuItem['direction'];
  isSelectedActivityRateRow: (row: AppTypes.ActivityListRow) => boolean;
  isActivityRateBlinking: (row: AppTypes.ActivityListRow) => boolean;
  getActivityRateDraftValue: (itemId: string) => number | undefined;
  normalizeRateScore: (value: number) => number;
  hasOwnRating: (item: RateMenuItem) => boolean;
  pairReceivedAverageScore: (item: RateMenuItem) => number;
  rateOwnScore: (item: RateMenuItem) => number;
}

export class ActivitiesPopupTemplatePresenter {
  constructor(private readonly deps: ActivitiesPopupTemplatePresenterDeps) {}

  activityChatTemplateData(
    row: AppTypes.ActivityListRow,
    groupLabel?: string | null
  ): ActivitiesChatTemplateData {
    const chat = row.source as ChatMenuItem;
    return buildActivitiesChatTemplateData(row, {
      groupLabel: groupLabel ?? null,
      activeUserInitials: this.deps.getActiveUser().initials,
      lastSenderGender: this.deps.getChatLastSender(chat).gender,
      memberCount: this.deps.getChatMemberCount(chat),
      channelType: this.deps.getChatChannelType(chat)
    });
  }

  activityEventInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return buildActivitiesEventInfoCard(row, {
      groupLabel: options.groupLabel ?? null,
      rowId: this.deps.getActivityRowIdentity(row),
      imageUrl: this.deps.getActivityImageUrl(row),
      range: this.deps.getActivityCalendarDateRange(row),
      isDraft: this.deps.isActivityDraft(row),
      isPending: this.deps.isPendingActivityRow(row),
      isFull: this.deps.isActivityFull(row),
      leadingIcon: this.deps.getActivityLeadingIcon(row),
      leadingTone: this.deps.getActivityLeadingIconTone(row),
      showSourceIcon: this.deps.shouldShowActivitySourceIcon(row),
      sourceAvatarTone: this.deps.getActivitySourceAvatarTone(row),
      sourceAvatarLabel: this.deps.getActivitySourceAvatarLabel(row),
      capacityLabel: this.deps.getActivityCapacityLabel(row),
      pendingCount: this.deps.getActivityPendingMemberCount(row),
      menuActions: this.deps.getActivityEventInfoCardMenuActions(row)
    });
  }

  activitySingleCard(
    row: AppTypes.ActivityListRow,
    options?: {
      groupLabel?: string | null;
      presentation?: SingleCardData['presentation'];
      state?: SingleCardData['state'];
    }
  ): SingleCardData {
    const presentation = options?.presentation ?? 'list';
    return buildActivitiesSingleRateCard(row, {
      groupLabel: options?.groupLabel ?? null,
      presentation,
      state: options?.state ?? 'default',
      displayedDirection: this.deps.getDisplayedRateDirection(row.source as RateMenuItem),
      users: this.deps.getUsers(),
      activeUserGender: this.deps.getActiveUser().gender,
      fullscreenSplitEnabled: !this.deps.isFullscreenPaginationAnimating(),
      badge: this.activityRateBadgeConfig(row, {
        layout: 'floating',
        interactive: presentation !== 'fullscreen',
        forceActive: presentation === 'fullscreen'
      })
    });
  }

  activityPairCard(
    row: AppTypes.ActivityListRow,
    options?: {
      groupLabel?: string | null;
      presentation?: PairCardData['presentation'];
      state?: PairCardData['state'];
    }
  ): PairCardData {
    const presentation = options?.presentation ?? 'list';
    return buildActivitiesPairRateCard(row, {
      groupLabel: options?.groupLabel ?? null,
      presentation,
      state: options?.state ?? 'default',
      displayedDirection: this.deps.getDisplayedRateDirection(row.source as RateMenuItem),
      users: this.deps.getUsers(),
      activeUserGender: this.deps.getActiveUser().gender,
      fullscreenSplitEnabled: !this.deps.isFullscreenPaginationAnimating(),
      badge: this.activityRateBadgeConfig(row, {
        layout: presentation === 'fullscreen' ? 'pair-overlap' : 'between',
        interactive: presentation !== 'fullscreen',
        forceActive: presentation === 'fullscreen'
      })
    });
  }

  readonly isPairRateRow = isActivitiesPairRateRow;

  isPairReceivedRateRow(row: AppTypes.ActivityListRow): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair' && this.deps.getDisplayedRateDirection(rate) === 'received';
  }

  activityRateBadgeConfig(
    row: AppTypes.ActivityListRow,
    options?: {
      layout?: CardBadgeConfig['layout'];
      interactive?: boolean;
      forceActive?: boolean;
    }
  ): CardBadgeConfig {
    return {
      label: this.activityRateBadgeLabel(row),
      ariaLabel: this.activityRateBadgeAriaLabel(row),
      active: options?.forceActive ? true : this.deps.isSelectedActivityRateRow(row),
      pending: this.isActivityRatePending(row),
      disabled: this.isPairReceivedRateRow(row),
      blink: this.deps.isActivityRateBlinking(row),
      interactive: options?.interactive ?? true,
      layout: options?.layout ?? 'floating'
    };
  }

  activityOwnRatingValue(row: AppTypes.ActivityListRow): number {
    if (row.type !== 'rates') {
      return 0;
    }

    const item = row.source as RateMenuItem;
    const drafted = this.deps.getActivityRateDraftValue(item.id);
    if (Number.isFinite(drafted)) {
      return this.deps.normalizeRateScore(Number(drafted));
    }
    if (!this.deps.hasOwnRating(item)) {
      if (this.deps.getDisplayedRateDirection(item) === 'received' && item.mode === 'pair') {
        return this.deps.pairReceivedAverageScore(item);
      }
      return 0;
    }
    return this.deps.rateOwnScore(item);
  }

  activityOwnRatingLabel(row: AppTypes.ActivityListRow): string {
    const value = this.activityOwnRatingValue(row);
    return value > 0 ? `${value}` : '';
  }

  isActivityRatePending(row: AppTypes.ActivityListRow): boolean {
    if (row.type !== 'rates') {
      return false;
    }

    const item = row.source as RateMenuItem;
    if (this.deps.getDisplayedRateDirection(item) === 'met') {
      return false;
    }
    if (!this.deps.hasOwnRating(item) && this.deps.getDisplayedRateDirection(item) === 'received' && item.mode === 'pair') {
      return this.deps.pairReceivedAverageScore(item) <= 0;
    }
    return !this.deps.hasOwnRating(item);
  }

  private activityRateBadgeLabel(row: AppTypes.ActivityListRow): string {
    const ownLabel = this.activityOwnRatingLabel(row);
    return ownLabel ? ownLabel : 'Rate';
  }

  private activityRateBadgeAriaLabel(row: AppTypes.ActivityListRow): string {
    if (this.isPairReceivedRateRow(row)) {
      return 'Received pair rating';
    }
    return this.isActivityRatePending(row) ? 'Add your rating' : 'Edit your rating';
  }
}
