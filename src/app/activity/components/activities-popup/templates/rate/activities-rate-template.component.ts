import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import type { RateMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../../../shared/core/base/interfaces/user.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import {
  PairCardComponent,
  SingleCardComponent,
  type CardBadgeConfig,
  type PairCardData,
  type SingleCardData
} from '../../../../../shared/ui';
import {
  buildActivitiesPairRateCard,
  buildActivitiesSingleRateCard,
  isActivitiesPairRateRow
} from './activities-rate-template.builder';

export interface ActivitiesRateTemplateContext {
  getUsers: () => readonly DemoUser[];
  getActiveUserGender: () => 'woman' | 'man';
  getDisplayedDirection: (item: RateMenuItem) => RateMenuItem['direction'];
  isSelectedActivityRateRow: (row: AppTypes.ActivityListRow) => boolean;
  isActivityRateBlinking: (row: AppTypes.ActivityListRow) => boolean;
  getActivityRateDraftValue: (itemId: string) => number | undefined;
  normalizeRateScore: (value: number) => number;
  hasOwnRating: (item: RateMenuItem) => boolean;
  pairReceivedAverageScore: (item: RateMenuItem) => number;
  rateOwnScore: (item: RateMenuItem) => number;
  isFullscreenPaginationAnimating: () => boolean;
}

@Component({
  selector: 'app-activities-rate-template',
  standalone: true,
  imports: [CommonModule, SingleCardComponent, PairCardComponent],
  templateUrl: './activities-rate-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesRateTemplateComponent {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() presentation: SingleCardData['presentation'] | PairCardData['presentation'] = 'list';
  @Input() state: SingleCardData['state'] | PairCardData['state'] = 'default';
  @Input() context: ActivitiesRateTemplateContext | null = null;

  @Output() readonly badgeClick = new EventEmitter<void>();

  protected get pairCard(): PairCardData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context || !isActivitiesPairRateRow(row)) {
      return null;
    }
    return buildActivitiesPairRateCard(row, {
      groupLabel: this.groupLabel,
      presentation: this.presentation,
      state: this.state,
      displayedDirection: context.getDisplayedDirection(row.source as RateMenuItem),
      users: context.getUsers(),
      activeUserGender: context.getActiveUserGender(),
      fullscreenSplitEnabled: !context.isFullscreenPaginationAnimating(),
      badge: this.activityRateBadgeConfig(row, context, {
        layout: this.presentation === 'fullscreen' ? 'pair-overlap' : 'between',
        interactive: this.presentation !== 'fullscreen',
        forceActive: this.presentation === 'fullscreen'
      })
    });
  }

  protected get singleCard(): SingleCardData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context || isActivitiesPairRateRow(row)) {
      return null;
    }
    return buildActivitiesSingleRateCard(row, {
      groupLabel: this.groupLabel,
      presentation: this.presentation,
      state: this.state,
      displayedDirection: context.getDisplayedDirection(row.source as RateMenuItem),
      users: context.getUsers(),
      activeUserGender: context.getActiveUserGender(),
      fullscreenSplitEnabled: !context.isFullscreenPaginationAnimating(),
      badge: this.activityRateBadgeConfig(row, context, {
        layout: 'floating',
        interactive: this.presentation !== 'fullscreen',
        forceActive: this.presentation === 'fullscreen'
      })
    });
  }

  protected onBadgeClick(): void {
    this.badgeClick.emit();
  }

  private isPairReceivedRateRow(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): boolean {
    const rate = row.source as RateMenuItem;
    return rate.mode === 'pair' && context.getDisplayedDirection(rate) === 'received';
  }

  private activityRateBadgeConfig(
    row: AppTypes.ActivityListRow,
    context: ActivitiesRateTemplateContext,
    options?: {
      layout?: CardBadgeConfig['layout'];
      interactive?: boolean;
      forceActive?: boolean;
    }
  ): CardBadgeConfig {
    return {
      label: this.activityRateBadgeLabel(row, context),
      ariaLabel: this.activityRateBadgeAriaLabel(row, context),
      active: options?.forceActive ? true : context.isSelectedActivityRateRow(row),
      pending: this.isActivityRatePending(row, context),
      disabled: this.isPairReceivedRateRow(row, context),
      blink: context.isActivityRateBlinking(row),
      interactive: options?.interactive ?? true,
      layout: options?.layout ?? 'floating'
    };
  }

  private activityOwnRatingValue(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): number {
    if (row.type !== 'rates') {
      return 0;
    }
    const item = row.source as RateMenuItem;
    const drafted = context.getActivityRateDraftValue(item.id);
    if (Number.isFinite(drafted)) {
      return context.normalizeRateScore(Number(drafted));
    }
    if (!context.hasOwnRating(item)) {
      if (context.getDisplayedDirection(item) === 'received' && item.mode === 'pair') {
        return context.pairReceivedAverageScore(item);
      }
      return 0;
    }
    return context.rateOwnScore(item);
  }

  private activityOwnRatingLabel(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): string {
    const value = this.activityOwnRatingValue(row, context);
    return value > 0 ? `${value}` : '';
  }

  private isActivityRatePending(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): boolean {
    if (row.type !== 'rates') {
      return false;
    }
    const item = row.source as RateMenuItem;
    if (context.getDisplayedDirection(item) === 'met') {
      return false;
    }
    if (!context.hasOwnRating(item) && context.getDisplayedDirection(item) === 'received' && item.mode === 'pair') {
      return context.pairReceivedAverageScore(item) <= 0;
    }
    return !context.hasOwnRating(item);
  }

  private activityRateBadgeLabel(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): string {
    const ownLabel = this.activityOwnRatingLabel(row, context);
    return ownLabel ? ownLabel : 'Rate';
  }

  private activityRateBadgeAriaLabel(row: AppTypes.ActivityListRow, context: ActivitiesRateTemplateContext): string {
    if (this.isPairReceivedRateRow(row, context)) {
      return 'Received pair rating';
    }
    return this.isActivityRatePending(row, context) ? 'Add your rating' : 'Edit your rating';
  }
}
