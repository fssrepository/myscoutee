import { Injectable, inject } from '@angular/core';

import type { AdminUserDto } from '../../../../admin/models/admin-profile.model';
import type {
  AdminModerationActionResult,
  AdminModerationUserPatch
} from '../../base/services/admin-moderation-data.service';
import type { ChatPopupMessage } from '../../base/models/chat.model';
import type { ChatThreadRecord } from '../../base/models/chats.model';
import { LocalAdminDemoDataService } from './admin-demo-data.service';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_MODERATION_WARN_ROUTE = '/admin/reports/warn';
const ADMIN_MODERATION_BLOCK_ROUTE = '/admin/reports/block';
const ADMIN_MODERATION_UNBLOCK_ROUTE = '/admin/reports/unblock';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminModerationService extends LocalRouteDelayService {
  private readonly demoData = inject(LocalAdminDemoDataService);

  async warnUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_WARN_ROUTE);
    const supportPatch = await this.appendSupportMessage(normalizedUserId, this.resolveAdmin(admin), message);
    return { userPatch: supportPatch };
  }

  async blockUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_BLOCK_ROUTE);
    const user = this.demoData.queryUserById(normalizedUserId);
    if (user) {
      await this.demoData.upsertUser({
        ...user,
        previousProfileStatus: user.profileStatus,
        profileStatus: 'blocked'
      });
    }
    const supportPatch = await this.appendSupportMessage(normalizedUserId, this.resolveAdmin(admin), message);
    return {
      userPatch: {
        ...supportPatch,
        profileStatus: 'blocked',
        blockedAtIso: new Date().toISOString()
      }
    };
  }

  async unblockUser(
    userId: string,
    admin: AdminUserDto | null | undefined
  ): Promise<AdminModerationActionResult | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_UNBLOCK_ROUTE);
    const user = this.demoData.queryUserById(normalizedUserId);
    const nextStatus = user?.previousProfileStatus && user.previousProfileStatus !== 'blocked'
      ? user.previousProfileStatus
      : 'public';
    if (user) {
      await this.demoData.upsertUser({
        ...user,
        previousProfileStatus: undefined,
        profileStatus: nextStatus
      });
    }
    return {
      userPatch: {
        userId: normalizedUserId,
        profileStatus: nextStatus,
        blockedAtIso: null,
        hasSupportChat: this.supportChatExists(this.resolveAdmin(admin).id, normalizedUserId),
        supportChatUnread: this.supportChatUnread(this.resolveAdmin(admin).id, normalizedUserId)
      }
    };
  }

  private async appendSupportMessage(
    userId: string,
    admin: AdminUserDto,
    text: string
  ): Promise<AdminModerationUserPatch> {
    const reportedUser = this.demoData.queryUserById(userId);
    const now = new Date();
    const nowIso = now.toISOString();
    const chatId = `c-support-admin-${userId}`;
    const messageId = `m-admin-${Date.now()}`;
    const adminAvatar = {
      id: admin.id,
      initials: admin.initials,
      gender: admin.id.includes('noel') ? 'man' as const : 'woman' as const
    };
    const userChat: ChatThreadRecord = {
      id: chatId,
      avatar: admin.initials,
      title: 'MyScoutee Support',
      lastMessage: text,
      lastSenderId: admin.id,
      memberIds: [userId, admin.id],
      unread: 1,
      dateIso: nowIso,
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: userId,
      messages: []
    };
    const userMessage: ChatPopupMessage = {
      id: messageId,
      sender: admin.name,
      senderAvatar: adminAvatar,
      text,
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: nowIso,
      mine: false,
      readBy: []
    };
    const adminChat: ChatThreadRecord = {
      id: chatId,
      avatar: reportedUser?.initials || 'U',
      title: `MyScoutee Support · ${reportedUser?.name || 'Reported user'}`,
      lastMessage: text,
      lastSenderId: admin.id,
      memberIds: [userId, admin.id],
      unread: 0,
      dateIso: nowIso,
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: admin.id,
      messages: []
    };
    const adminMessage: ChatPopupMessage = {
      ...userMessage,
      mine: true,
      readBy: []
    };
    await this.demoData.upsertSupportChatMessage(userChat, userMessage, true);
    await this.demoData.upsertSupportChatMessage(adminChat, adminMessage, false);
    return {
      userId,
      hasSupportChat: true,
      supportChatUnread: 0
    };
  }

  private supportChatExists(adminId: string, userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return false;
    }
    return this.demoData.queryChatItemsByUser(normalizedAdminId)
      .some(chat => chat.id === `c-support-admin-${normalizedUserId}`);
  }

  private supportChatUnread(adminId: string, userId: string): number {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return 0;
    }
    const chat = this.demoData.queryChatItemsByUser(normalizedAdminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
  }

  private resolveAdmin(admin: AdminUserDto | null | undefined): AdminUserDto {
    return admin ?? {
      id: 'admin-demo-ava',
      name: 'Ava',
      initials: 'AM',
      email: 'ava.admin@myscoutee.local',
      images: []
    };
  }
}
