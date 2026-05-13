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
  showSupportControls: boolean;
  supportCaseStatus: AppTypes.SupportCaseStatus | null;
  supportCaseLabelKey: string;
  supportCaseBadgeClass: string;
  supportCaseAssigneeName: string;
}

interface BuildActivitiesChatTemplateDataOptions {
  groupLabel?: string | null;
  activeUserInitials: string;
  lastSenderGender: 'woman' | 'man';
  memberCount: number;
  channelType: AppTypes.ChatChannelType;
  adminServiceMode?: boolean;
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
    toneClass: activitiesChatToneClass(options.channelType, chat, options.adminServiceMode === true),
    showSupportControls: options.adminServiceMode === true && Boolean(chat.supportCaseStatus),
    supportCaseStatus: supportCaseStatus(chat.supportCaseStatus),
    supportCaseLabelKey: supportCaseLabelKey(chat.supportCaseStatus),
    supportCaseBadgeClass: supportCaseBadgeClass(chat.supportCaseStatus),
    supportCaseAssigneeName: supportCaseAssigneeName(chat)
  };
}

function activitiesChatToneClass(channelType: AppTypes.ChatChannelType, chat: ChatMenuItem, adminServiceMode: boolean): string {
  const supportTone = adminServiceMode && chat.supportCaseStatus
    ? ` activities-card-support-case-${supportCaseBadgeClass(chat.supportCaseStatus).replace('support-case-', '')}`
    : '';
  if (channelType === 'mainEvent') {
    return `activities-card-chat-main-event${supportTone}`;
  }
  if (channelType === 'optionalSubEvent') {
    return `activities-card-chat-optional-sub-event${supportTone}`;
  }
  if (channelType === 'groupSubEvent') {
    return `activities-card-chat-group-sub-event${supportTone}`;
  }
  if (channelType === 'serviceEvent') {
    return `${serviceChatToneClass(chat)}${supportTone}`;
  }
  return supportTone.trim();
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

function supportCaseStatus(status: ChatMenuItem['supportCaseStatus']): AppTypes.SupportCaseStatus | null {
  if (status === 'pending' || status === 'picked' || status === 'solved' || status === 'blocked') {
    return status;
  }
  return null;
}

function supportCaseLabelKey(status: ChatMenuItem['supportCaseStatus']): string {
  if (status === 'picked') {
    return 'activities.support.case.status.picked';
  }
  if (status === 'solved') {
    return 'activities.support.case.status.solved';
  }
  if (status === 'blocked') {
    return 'activities.support.case.status.blocked';
  }
  return 'activities.support.case.status.pending';
}

function supportCaseBadgeClass(status: ChatMenuItem['supportCaseStatus']): string {
  if (status === 'picked') {
    return 'support-case-picked';
  }
  if (status === 'solved') {
    return 'support-case-solved';
  }
  if (status === 'blocked') {
    return 'support-case-blocked';
  }
  return 'support-case-pending';
}

function supportCaseAssigneeName(chat: ChatMenuItem): string {
  return `${chat.supportCaseAssigneeName ?? ''}`.trim();
}
