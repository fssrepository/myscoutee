import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';

import { AppUtils } from '../../../../../shared/app-utils';
import { I18nService } from '../../../../../shared/core';
import type { ChatDTO } from '../../../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../../../shared/core/contracts/user.interface';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import {
  type CardMenuActionEvent,
  SingleRowComponent,
  type SingleRowData
} from '../../../../../shared/ui';
import {
  buildActivitiesChatSingleRowData
} from './activities-chat-template.builder';

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [SingleRowComponent],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent implements OnChanges {
  private readonly i18n = inject(I18nService);

  @Input() row: SingleRowData | null = null;
  @Input() groupLabel: string | null = null;
  @Input() activeUserInitials = '';
  @Input() adminServiceMode = false;

  @Output() readonly rowClick = new EventEmitter<Event>();
  @Output() readonly supportCaseAction = new EventEmitter<ContractTypes.SupportCaseAction>();

  protected singleRow: SingleRowData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['activeUserInitials'] || changes['adminServiceMode']) {
      this.singleRow = this.buildSingleRowData();
    }
  }

  private buildSingleRowData(): SingleRowData | null {
    const row = this.row;
    if (!row) {
      return null;
    }
    return buildActivitiesChatSingleRowData(row, {
      groupLabel: this.groupLabel,
      activeUserInitials: this.activeUserInitials,
      adminServiceMode: this.adminServiceMode,
      translate: key => this.i18n.translate(key)
    });
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
  private cachedUsersRef: readonly UserDto[] | null = null;
  private cachedChatItemsRef: readonly ChatDTO[] | null = null;
  private readonly userByIdCache = new Map<string, UserDto>();
  private readonly chatItemByIdCache = new Map<string, ChatDTO>();
  private readonly chatMembersByIdCache = new Map<string, UserDto[]>();
  private readonly chatLastSenderByIdCache = new Map<string, UserDto>();
  private cachedOtherUsers: UserDto[] = [];

  private get activeUser() { return this.host.activeUser as UserDto; }
  private get activitiesStore() { return this.host.activitiesStore; }
  private get chatItems() {
    const activeUserId = `${this.activeUser?.id ?? ''}`.trim();
    return activeUserId
      ? this.host.chatsService.peekChatItemsByUser(activeUserId) as ChatDTO[]
      : [];
  }
  private get users() { return this.host.users as UserDto[]; }

  public chatChannelType(item: ChatDTO): ContractTypes.ChatChannelType {
    if (
      item.channelType === 'mainEvent'
      || item.channelType === 'optionalSubEvent'
      || item.channelType === 'groupSubEvent'
      || item.channelType === 'serviceEvent'
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
    const users = this.users;
    const chatItems = this.chatItems;
    if (
      this.cachedActiveUserRef === activeUser
      && this.cachedUsersRef === users
      && this.cachedChatItemsRef === chatItems
    ) {
      return;
    }

    this.cachedActiveUserRef = activeUser;
    this.cachedUsersRef = users;
    this.cachedChatItemsRef = chatItems;
    this.userByIdCache.clear();
    this.chatItemByIdCache.clear();
    this.chatMembersByIdCache.clear();
    this.chatLastSenderByIdCache.clear();
    this.cachedOtherUsers = [];

    for (const user of users) {
      this.userByIdCache.set(user.id, user);
      if (user.id !== activeUser.id) {
        this.cachedOtherUsers.push(user);
      }
    }

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
      .map(memberId => this.userByIdCache.get(memberId))
      .filter((user): user is UserDto => Boolean(user));
    const lastSender = chatItem?.lastSenderId
      ? this.userByIdCache.get(chatItem.lastSenderId) ?? null
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

    const others = this.cachedOtherUsers;
    if (!others.length) {
      const fallbackMembers = [this.activeUser];
      this.chatMembersByIdCache.set(chatId, fallbackMembers);
      return fallbackMembers;
    }
    const seed = AppUtils.hashText(chatId);
    const offsets = [0, 3, 7, 11, 15, 19];
    const memberCount = 3 + (seed % 3);
    const picked: UserDto[] = [];
    for (const offset of offsets) {
      const user = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === user.id)) {
        picked.push(user);
      }
      if (picked.length === memberCount) {
        break;
      }
    }
    while (picked.length < memberCount) {
      picked.push(others[picked.length % others.length]);
    }
    this.chatMembersByIdCache.set(chatId, picked);
    return picked;
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
    const nextLastSender = this.userByIdCache.get(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
    this.chatLastSenderByIdCache.set(item.id, nextLastSender);
    return nextLastSender;
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
    const channelType = this.chatChannelType(item);
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
    return null;
  }
}
