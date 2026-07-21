import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import type { ChatDTO } from '../../../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../../../shared/core/contracts/user.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import {
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../../../../shared/ui/context/stores/activities-popup.store';
import {
  type CardMenuActionEvent,
  SingleRowComponent,
  type SingleRowData
} from '../../../../../shared/ui';

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [SingleRowComponent],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent implements OnChanges {
  @Input() row: SingleRowData | null = null;
  @Input() groupLabel: string | null = null;

  @Output() readonly rowClick = new EventEmitter<Event>();
  @Output() readonly supportCaseAction = new EventEmitter<ContractTypes.SupportCaseAction>();

  protected singleRow: SingleRowData | null = null;

  ngOnChanges(): void {
    const row = this.row;
    if (!row) {
      this.singleRow = null;
      return;
    }
    this.singleRow = {
      ...row,
      groupLabel: this.groupLabel
    };
  }

  protected onRowClick(event: Event): void {
    this.rowClick.emit(event);
  }

  protected onSingleRowMenuAction(event: CardMenuActionEvent<SingleRowData>): void {
    const action = this.supportCaseActionForMenuAction(event.actionId);
    if (!action) {
      return;
    }
    this.supportCaseAction.emit(action);
  }

  private supportCaseActionForMenuAction(actionId: string): ContractTypes.SupportCaseAction | null {
    switch (actionId) {
      case 'supportPick':
        return 'pick';
      case 'supportUnpick':
        return 'unpick';
      case 'supportSolve':
        return 'solve';
      case 'supportBlock':
        return 'block';
      case 'supportReopen':
        return 'reopen';
      default:
        return null;
    }
  }
}

type ActivitiesChatsHost = any;

export class ActivitiesChatsController {
  constructor(private readonly host: ActivitiesChatsHost) {}

  private get activeUser() { return this.host.activeUser as UserDto; }
  private get activitiesStore() { return this.host.activitiesStore; }

  public chatChannelType(item: ChatDTO): ContractTypes.ChatChannelType {
    if (
      item.channelType === 'mainEvent'
      || item.channelType === 'optionalSubEvent'
      || item.channelType === 'groupSubEvent'
      || item.channelType === 'serviceEvent'
      || item.channelType === 'appSupport'
      || item.channelType === 'supportCase'
    ) {
      return item.channelType;
    }
    return 'general';
  }

  private getChatMembers(item: ChatDTO): UserDto[] {
    const explicitMembers = (item.memberIds ?? [])
      .map(memberId => this.resolveUserById(memberId))
      .filter((user): user is UserDto => Boolean(user));
    const lastSender = item.lastSenderId
      ? this.resolveUserById(item.lastSenderId)
      : null;

    const orderedMembers: UserDto[] = [];
    if (lastSender) {
      orderedMembers.push(lastSender);
    }
    for (const member of explicitMembers) {
      if (!orderedMembers.some(item => item.id === member.id)) {
        orderedMembers.push(member);
      }
    }
    if (!orderedMembers.some(item => item.id === this.activeUser.id)) {
      orderedMembers.push(this.activeUser);
    }
    if (orderedMembers.length > 0) {
      return orderedMembers;
    }
    return [this.activeUser];
  }

  private explicitChatMemberCount(item: ChatDTO | null | undefined): number {
    const uniqueIds = new Set(
      (item?.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    );
    return uniqueIds.size;
  }

  public getChatLastSender(item: ChatDTO): UserDto {
    return this.resolveUserById(item.lastSenderId) ?? this.getChatMembers(item)[0] ?? this.activeUser;
  }

  private resolveUserById(userId: string | null | undefined): UserDto | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return null;
    }
    if (normalizedUserId === this.activeUser.id) {
      return this.activeUser;
    }
    return null;
  }

  public getChatMemberCount(item: ChatDTO): number {
    const explicitCount = this.explicitChatMemberCount(item);
    if (explicitCount > 0) {
      return explicitCount;
    }
    return this.getChatMembers(item).length;
  }

  public openActivityChat(chat: ChatDTO): void {
    this.activitiesStore.openEventChat(
      eventChatPopupRequestFromChat(chat),
      eventChatHeaderStateFromChat(chat)
    );
  }

  public activityChatContextFilterKey(item: ChatDTO): ContractTypes.ActivitiesChatContextFilter | null {
    return this.activityChatContextFilterKeyFromChannelType(this.chatChannelType(item));
  }

  public activityChatContextFilterKeyFromChannelType(
    channelType: ContractTypes.ChatChannelType | null | undefined
  ): ContractTypes.ActivitiesChatContextFilter | null {
    if (channelType === 'mainEvent') {
      return 'event';
    }
    if (channelType === 'optionalSubEvent') {
      return 'subEvent';
    }
    if (channelType === 'groupSubEvent') {
      return 'group';
    }
    if (channelType === 'serviceEvent') {
      return 'service';
    }
    if (channelType === 'appSupport' || channelType === 'supportCase') {
      return 'appSupport';
    }
    return null;
  }
}
