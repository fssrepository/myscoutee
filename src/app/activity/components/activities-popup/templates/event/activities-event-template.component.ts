import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import type * as AppTypes from '../../../../../shared/core/base/models';
import {
  InfoCardComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent
} from '../../../../../shared/ui';
import { buildActivitiesEventInfoCard } from './activities-event-template.builder';

export interface ActivitiesEventTemplateContext {
  getActivityRowIdentity: (row: AppTypes.ActivityListRow) => string;
  getActivityImageUrl: (row: AppTypes.ActivityListRow) => string | null;
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
}

@Component({
  selector: 'app-activities-event-template',
  standalone: true,
  imports: [CommonModule, InfoCardComponent],
  templateUrl: './activities-event-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesEventTemplateComponent {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() context: ActivitiesEventTemplateContext | null = null;

  @Output() readonly mediaEndClick = new EventEmitter<void>();
  @Output() readonly menuAction = new EventEmitter<InfoCardMenuActionEvent>();

  protected get card(): InfoCardData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context) {
      return null;
    }
    return buildActivitiesEventInfoCard(row, {
      groupLabel: this.groupLabel,
      rowId: context.getActivityRowIdentity(row),
      imageUrl: context.getActivityImageUrl(row),
      range: context.getActivityCalendarDateRange(row),
      isDraft: context.isActivityDraft(row),
      isPending: context.isPendingActivityRow(row),
      isFull: context.isActivityFull(row),
      leadingIcon: context.getActivityLeadingIcon(row),
      leadingTone: context.getActivityLeadingIconTone(row),
      showSourceIcon: context.shouldShowActivitySourceIcon(row),
      sourceAvatarTone: context.getActivitySourceAvatarTone(row),
      sourceAvatarLabel: context.getActivitySourceAvatarLabel(row),
      capacityLabel: context.getActivityCapacityLabel(row),
      pendingCount: context.getActivityPendingMemberCount(row),
      menuActions: context.getActivityEventInfoCardMenuActions(row)
    });
  }

  protected onMediaEndClick(): void {
    this.mediaEndClick.emit();
  }

  protected onMenuAction(event: InfoCardMenuActionEvent): void {
    this.menuAction.emit(event);
  }
}
