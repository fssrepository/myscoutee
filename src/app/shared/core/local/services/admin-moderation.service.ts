import { Injectable, inject } from '@angular/core';

import type { AdminUserDto } from '../../contracts/admin.interface';
import type {
  AdminModerationActionResult,
  AdminModerationUserPatch
} from '../../base/services/admin-moderation.service';
import type { ChatPopupMessage } from '../../base/models/chat.model';
import type { ChatThreadRecord } from '../../base/models/chats.model';
import { LocalAdminSupportSessionService } from './admin-support-session.service';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_MODERATION_WARN_ROUTE = '/admin/reports/warn';
const ADMIN_MODERATION_BLOCK_ROUTE = '/admin/reports/block';
const ADMIN_MODERATION_UNBLOCK_ROUTE = '/admin/reports/unblock';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminModerationService extends LocalRouteDelayService {
  private readonly supportSession = inject(LocalAdminSupportSessionService);

  async warnUser(
    userId: string,
    admin: AdminUserDto | null | undefined,
    message: string
  ): Promise<AdminModerationActionResult | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const resolvedAdmin = this.resolveAdmin(admin);
    if (!resolvedAdmin) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_WARN_ROUTE);
    const supportPatch = await this.appendSupportMessage(normalizedUserId, resolvedAdmin, message);
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
    const resolvedAdmin = this.resolveAdmin(admin);
    if (!resolvedAdmin) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_BLOCK_ROUTE);
    const user = this.supportSession.findUser(normalizedUserId);
    if (user) {
      await this.supportSession.saveUser({
        ...user,
        previousProfileStatus: user.profileStatus,
        profileStatus: 'blocked'
      });
    }
    const supportPatch = await this.appendSupportMessage(normalizedUserId, resolvedAdmin, message);
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
    const resolvedAdmin = this.resolveAdmin(admin);
    if (!resolvedAdmin) {
      return null;
    }
    await this.waitForRouteDelay(ADMIN_MODERATION_UNBLOCK_ROUTE);
    const user = this.supportSession.findUser(normalizedUserId);
    const nextStatus = user?.previousProfileStatus && user.previousProfileStatus !== 'blocked'
      ? user.previousProfileStatus
      : 'public';
    if (user) {
      await this.supportSession.saveUser({
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
        hasSupportChat: this.supportChatExists(resolvedAdmin.id, normalizedUserId),
        supportChatUnread: this.supportChatUnread(resolvedAdmin.id, normalizedUserId)
      }
    };
  }

  private async appendSupportMessage(
    userId: string,
    admin: AdminUserDto,
    text: string
  ): Promise<AdminModerationUserPatch> {
    const reportedUser = this.supportSession.findUser(userId);
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
    await this.supportSession.upsertSupportChatMessage(userChat, userMessage, true);
    await this.supportSession.upsertSupportChatMessage(adminChat, adminMessage, false);
    return {
      userId,
      hasSupportChat: true,
      supportChatUnread: 0
    };
  }

  private supportChatExists(adminId: string, userId: string): boolean {
    return this.supportSession.supportChatExists(adminId, userId);
  }

  private supportChatUnread(adminId: string, userId: string): number {
    return this.supportSession.supportChatUnread(adminId, userId);
  }

  private resolveAdmin(admin: AdminUserDto | null | undefined): AdminUserDto | null {
    const id = `${admin?.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    return {
      id,
      name: `${admin?.name ?? ''}`.trim() || 'Admin',
      initials: `${admin?.initials ?? ''}`.trim() || 'AD',
      email: `${admin?.email ?? ''}`.trim() || `${id}@myscoutee.local`,
      headline: admin?.headline ?? null,
      about: admin?.about ?? null,
      images: [...(admin?.images ?? [])]
    };
  }
}
