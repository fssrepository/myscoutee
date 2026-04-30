import type * as AppTypes from '../../../../../shared/core/base/models';
import type { ChatMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';

export interface ActivitiesChatTemplateData {
  title: string;
  subtitle: string;
  detail: string;
  unread: number;
  memberCount: number;
  groupLabel: string | null;
  avatarInitials: string;
  avatarClass: string;
  toneClass: string;
}

interface BuildActivitiesChatTemplateDataOptions {
  groupLabel?: string | null;
  activeUserInitials: string;
  lastSenderGender: 'woman' | 'man';
  memberCount: number;
  channelType: AppTypes.ChatChannelType;
}

export function buildActivitiesChatTemplateData(
  row: AppTypes.ActivityListRow,
  options: BuildActivitiesChatTemplateDataOptions
): ActivitiesChatTemplateData {
  const chat = row.source as ChatMenuItem;
  const avatar = typeof chat.avatar === 'string' ? chat.avatar.trim() : '';

  return {
    title: row.title,
    subtitle: row.subtitle,
    detail: row.detail,
    unread: row.unread ?? 0,
    memberCount: options.memberCount,
    groupLabel: options.groupLabel ?? null,
    avatarInitials: avatar ? avatar.slice(0, 2).toUpperCase() : options.activeUserInitials,
    avatarClass: `user-color-${options.lastSenderGender}`,
    toneClass: activitiesChatToneClass(options.channelType, chat)
  };
}

function activitiesChatToneClass(channelType: AppTypes.ChatChannelType, chat: ChatMenuItem): string {
  if (channelType === 'mainEvent') {
    return 'activities-card-chat-main-event';
  }
  if (channelType === 'optionalSubEvent') {
    return 'activities-card-chat-optional-sub-event';
  }
  if (channelType === 'groupSubEvent') {
    return 'activities-card-chat-group-sub-event';
  }
  if (channelType === 'serviceEvent') {
    return serviceChatToneClass(chat);
  }
  return '';
}

function serviceChatToneClass(chat: ChatMenuItem): string {
  if (
    chat.serviceContext === 'notification'
    || chat.title.startsWith('Notify Participants')
    || chat.lastMessage.toLowerCase().includes('notification channel')
  ) {
    return 'activities-card-chat-service-notification';
  }
  if (chat.serviceContext === 'asset' || chat.id.startsWith('c-service-asset-') || chat.title.startsWith('Asset Service')) {
    return 'activities-card-chat-service-asset';
  }
  return 'activities-card-chat-service-event';
}
