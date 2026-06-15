import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../../../shared/app-utils';
import type { ChatRecord } from '../../../../../shared/core/contracts/chat.interface';
import type { UserDto } from '../../../../../shared/core/contracts/user.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import type * as ContractTypes from '../../../../../shared/core/contracts';
import {
  AppMenuComponent,
  CounterBadgePipe,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../../../shared/ui';
import { I18nPipe } from '../../../../../shared/ui';
import {
  buildActivitiesChatTemplateData,
  type ActivitiesChatTemplateData
} from './activities-chat-template.builder';

@Component({
  selector: 'app-activities-chat-template',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent, CounterBadgePipe, I18nPipe],
  templateUrl: './activities-chat-template.component.html',
  styleUrl: './activities-chat-template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesChatTemplateComponent implements OnChanges {
  @Input() row: AppTypes.ActivityListRow | null = null;
  @Input() groupLabel: string | null = null;
  @Input() activeUserInitials = '';
  @Input() adminServiceMode = false;

  @Output() readonly rowClick = new EventEmitter<Event>();
  @Output() readonly supportCaseAction = new EventEmitter<ContractTypes.SupportCaseAction>();

  protected data: ActivitiesChatTemplateData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row'] || changes['groupLabel'] || changes['activeUserInitials'] || changes['adminServiceMode']) {
      this.data = this.buildTemplateData();
    }
  }

  private buildTemplateData(): ActivitiesChatTemplateData | null {
    const row = this.row;
    if (!row || row.type !== 'chats') {
      return null;
    }
    return buildActivitiesChatTemplateData(row, {
      groupLabel: this.groupLabel,
      activeUserInitials: this.activeUserInitials,
      adminServiceMode: this.adminServiceMode
    });
  }

  protected onRowClick(event: Event): void {
    this.rowClick.emit(event);
  }

  protected onRowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.rowClick.emit(event);
  }

  protected supportCaseMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'more_horiz',
      closeIcon: 'close',
      ariaLabel: 'activities.support.case.actions',
      hideLabel: true,
      palette: 'blue',
      shape: 'icon'
    };
  }

  protected supportCaseMenuItems(): readonly AppMenuItem<string, { action: ContractTypes.SupportCaseAction }>[] {
    return this.supportCaseActions().map(item => ({
      id: `support-case-action:${item.action}`,
      label: item.labelKey,
      icon: item.icon,
      palette: this.supportCaseMenuPalette(item.tone),
      surface: 'tinted',
      context: { action: item.action }
    }));
  }

  protected onSupportCaseMenuSelect(event: AppMenuItemSelectEvent<string, { action: ContractTypes.SupportCaseAction }>): void {
    const action = event.context?.action;
    if (!action) {
      return;
    }
    this.supportCaseAction.emit(action);
  }

  protected supportCaseActions(): Array<{ action: ContractTypes.SupportCaseAction; labelKey: string; icon: string; tone: string }> {
    const status = this.data?.supportCaseStatus ?? 'pending';
    if (status === 'solved' || status === 'blocked') {
      return [
        { action: 'reopen', labelKey: 'activities.support.case.action.reopen', icon: 'restart_alt', tone: 'neutral' }
      ];
    }
    if (status === 'picked') {
      return [
        { action: 'unpick', labelKey: 'activities.support.case.action.unpick', icon: 'person_remove', tone: 'neutral' },
        { action: 'solve', labelKey: 'activities.support.case.action.solve', icon: 'check_circle', tone: 'accent' },
        { action: 'block', labelKey: 'activities.support.case.action.block', icon: 'block', tone: 'danger' }
      ];
    }
    return [
      { action: 'pick', labelKey: 'activities.support.case.action.pick', icon: 'person_add', tone: 'accent' },
      { action: 'solve', labelKey: 'activities.support.case.action.solve', icon: 'check_circle', tone: 'accent' },
      { action: 'block', labelKey: 'activities.support.case.action.block', icon: 'block', tone: 'danger' }
    ];
  }

  private supportCaseMenuPalette(tone: string): AppMenuPalette {
    switch (tone) {
      case 'danger':
        return 'danger';
      case 'accent':
        return 'green';
      default:
        return 'neutral';
    }
  }
}

type ActivitiesChatsHost = any;

export class ActivitiesChatsController {
  constructor(private readonly host: ActivitiesChatsHost) {}

  private cachedActiveUserRef: UserDto | null = null;
  private cachedUsersRef: readonly UserDto[] | null = null;
  private cachedChatItemsRef: readonly ChatRecord[] | null = null;
  private readonly userByIdCache = new Map<string, UserDto>();
  private readonly chatItemByIdCache = new Map<string, ChatRecord>();
  private readonly chatMembersByIdCache = new Map<string, UserDto[]>();
  private readonly chatLastSenderByIdCache = new Map<string, UserDto>();
  private cachedOtherUsers: UserDto[] = [];

  private get activeUser() { return this.host.activeUser as UserDto; }
  private get activitiesContext() { return this.host.activitiesContext; }
  private get chatItems() { return this.host.chatItems as ChatRecord[]; }
  private get users() { return this.host.users as UserDto[]; }

  public chatChannelType(item: ChatRecord): ContractTypes.ChatChannelType {
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

  public chatItemsForActivities(): ChatRecord[] {
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

  private getChatItemById(chatId: string): ChatRecord | undefined {
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

  private explicitChatMemberCount(item: ChatRecord | null | undefined): number {
    const uniqueIds = new Set(
      (item?.memberIds ?? [])
        .map(memberId => `${memberId ?? ''}`.trim())
        .filter(Boolean)
    );
    return uniqueIds.size;
  }

  public getChatLastSender(item: ChatRecord): UserDto {
    this.syncChatLookupCache();
    const cachedLastSender = this.chatLastSenderByIdCache.get(item.id);
    if (cachedLastSender) {
      return cachedLastSender;
    }
    const nextLastSender = this.userByIdCache.get(item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
    this.chatLastSenderByIdCache.set(item.id, nextLastSender);
    return nextLastSender;
  }

  public getChatMemberCount(item: ChatRecord): number {
    const explicitCount = this.explicitChatMemberCount(item);
    if (explicitCount > 0) {
      return explicitCount;
    }
    return this.getChatMembersById(item.id).length;
  }

  public openActivityChat(chat: ChatRecord): void {
    this.activitiesContext.openEventChat(chat);
  }

  public activityChatContextFilterKey(item: ChatRecord): ContractTypes.ActivitiesChatContextFilter | null {
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
