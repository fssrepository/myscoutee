import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import type { ChatDTO } from '../../../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../../../shared/core/contracts/user.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
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

  private cachedActiveUserRef: UserDto | null = null;
  private cachedChatItemsRef: readonly ChatDTO[] | null = null;
  private readonly chatItemByIdCache = new Map<string, ChatDTO>();
  private readonly chatMembersByIdCache = new Map<string, UserDto[]>();
  private readonly chatLastSenderByIdCache = new Map<string, UserDto>();

  private get activeUser() { return this.host.activeUser as UserDto; }
  private get activitiesStore() { return this.host.activitiesStore; }
  private get chatItems() {
    const activeUserId = `${this.activeUser?.id ?? ''}`.trim();
    return activeUserId
      ? this.host.chatsService.peekChatItemsByUser(activeUserId) as ChatDTO[]
      : [];
  }

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

  public chatItemsForActivities(): ChatDTO[] {
    return this.chatItems.map(item => ({
      ...item,
      memberIds: [...(item.memberIds ?? [])],
      channelType: this.chatChannelType(item),
      unread: Math.max(0, Math.trunc(Number(item.unread) || 0))
    }));
  }

  private syncChatLookupCache(): void {
    const activeUser = this.activeUser;
    const chatItems = this.chatItems;
    if (
      this.cachedActiveUserRef === activeUser
      && this.cachedChatItemsRef === chatItems
    ) {
      return;
    }

    this.cachedActiveUserRef = activeUser;
    this.cachedChatItemsRef = chatItems;
    this.chatItemByIdCache.clear();
    this.chatMembersByIdCache.clear();
    this.chatLastSenderByIdCache.clear();

    for (const item of chatItems) {
      this.chatItemByIdCache.set(item.id, item);
    }
  }

  private getChatItemById(chatId: string): ChatDTO | undefined {
    this.syncChatLookupCache();
    return this.chatItemByIdCache.get(chatId);
  }

  private getChatMembersById(chatId: string): UserDto[] {
    this.syncChatLookupCache();
    const cachedMembers = this.chatMembersByIdCache.get(chatId);
    if (cachedMembers) {
      return cachedMembers;
    }

    const chatItem = this.getChatItemById(chatId);
    const explicitMembers = (chatItem?.memberIds ?? [])
      .map(memberId => this.resolveUserById(memberId))
      .filter((user): user is UserDto => Boolean(user));
    const lastSender = chatItem?.lastSenderId
      ? this.resolveUserById(chatItem.lastSenderId)
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
      this.chatMembersByIdCache.set(chatId, orderedMembers);
      return orderedMembers;
    }

    const fallbackMembers = [this.activeUser];
    this.chatMembersByIdCache.set(chatId, fallbackMembers);
    return fallbackMembers;
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
    this.syncChatLookupCache();
    const cachedLastSender = this.chatLastSenderByIdCache.get(item.id);
    if (cachedLastSender) {
      return cachedLastSender;
    }
    const nextLastSender = this.resolveUserById(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
    this.chatLastSenderByIdCache.set(item.id, nextLastSender);
    return nextLastSender;
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
    return this.getChatMembersById(item.id).length;
  }

  public openActivityChat(chat: ChatDTO): void {
    this.activitiesStore.openEventChat(chat);
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
