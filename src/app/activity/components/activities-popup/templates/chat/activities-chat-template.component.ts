import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import type { ChatMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../../../../shared/core/base/interfaces/user.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import { CounterBadgePipe } from '../../../../../shared/ui';
import {
  buildActivitiesChatTemplateData,
  type ActivitiesChatTemplateData
} from './activities-chat-template.builder';

export interface ActivitiesChatTemplateContext {
  getActiveUserInitials: () => string;
  getChatLastSender: (chat: ChatMenuItem) => DemoUser;
  getChatMemberCount: (chat: ChatMenuItem) => number;
  getChatChannelType: (chat: ChatMenuItem) => AppTypes.ChatChannelType;
}

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [CommonModule, CounterBadgePipe],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() context: ActivitiesChatTemplateContext | null = null;

  @Output() readonly rowClick = new EventEmitter<MouseEvent>();

  protected get data(): ActivitiesChatTemplateData | null {
    const row = this.row;
    const context = this.context;
    if (!row || !context) {
      return null;
    }
    const chat = row.source as ChatMenuItem;
    return buildActivitiesChatTemplateData(row, {
      groupLabel: this.groupLabel,
      activeUserInitials: context.getActiveUserInitials(),
      lastSenderGender: context.getChatLastSender(chat).gender,
      memberCount: context.getChatMemberCount(chat),
      channelType: context.getChatChannelType(chat)
    });
  }

  protected onRowClick(event: MouseEvent): void {
    this.rowClick.emit(event);
  }
}
