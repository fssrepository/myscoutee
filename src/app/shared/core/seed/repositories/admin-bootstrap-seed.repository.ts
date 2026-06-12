import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../base/interfaces/user.interface';
import type {
  AdminChatMessageDto,
  AdminHelpTarget,
  AdminModerationStore,
  AdminUserDto
} from '../../base/models';
import type { AdminMonitoringStateDto } from '../../base/models/admin-monitoring.model';
import type { AdminNotificationCenterState } from '../../base/models/admin-notification.model';
import type { ChatPopupMessage, ChatRecord } from '../../base/models/chat.model';
import type { ChatThreadRecord } from '../../base/models/chats.model';
import {
  AdminHelpSeedBuilder,
  AdminModerationSeedBuilder,
  AdminMonitoringSeedBuilder,
  AdminNotificationsSeedBuilder,
  AdminParamsSeedBuilder,
  AdminProfileSeedBuilder,
  AdminStatsSeedBuilder
} from '../builders/admin';
import { SeedChatsRepository } from './chats-seed.repository';
import { SeedHelpCenterRepository } from './help-center-seed.repository';
import { SeedIdeaPostsRepository } from './idea-posts-seed.repository';
import { SeedUsersRatingsRepository } from './users-ratings-seed.repository';
import { SeedUsersRepository } from './users-seed.repository';
import {
  SeedAdminStoreRepository,
  type SeedAdminMenuCounterState,
  type SeedAdminStores
} from './admin-store-seed.repository';
import { SeedAdminAffinityGraphRepository } from './admin-affinity-graph-seed.repository';
import { SeedShareTokensRepository } from './share-tokens-seed.repository';

@Injectable({
  providedIn: 'root'
})
export class SeedAdminBootstrapRepository {
  private readonly location = inject(Location);
  private readonly usersSeed = inject(SeedUsersRepository);
  private readonly usersRatingsSeed = inject(SeedUsersRatingsRepository);
  private readonly affinityGraphSeed = inject(SeedAdminAffinityGraphRepository);
  private readonly chatsSeed = inject(SeedChatsRepository);
  private readonly shareTokensSeed = inject(SeedShareTokensRepository);
  private readonly storeSeed = inject(SeedAdminStoreRepository);
  private readonly helpCenterSeed = inject(SeedHelpCenterRepository);
  private readonly ideaPostsSeed = inject(SeedIdeaPostsRepository);

  async whenUsersReady(): Promise<void> {
    await this.usersSeed.whenReady();
  }

  async seedHelpCenter(): Promise<boolean> {
    return await this.helpCenterSeed.seedDefaults();
  }

  async seedIdeaPosts(): Promise<boolean> {
    return await this.ideaPostsSeed.seedDefaults();
  }

  seedUsers(): UserDto[] {
    return this.usersSeed.seedDefaults();
  }

  seedUserRatings(seedUsers?: readonly UserDto[]): void {
    this.usersRatingsSeed.seedDefaults(seedUsers);
  }

  seedChats(): void {
    this.chatsSeed.seedDefaults();
  }

  async seedDemoAdminProfiles(): Promise<void> {
    for (const admin of [
      this.resolveDemoAdmin('admin-demo-ava'),
      this.resolveDemoAdmin('admin-demo-noel')
    ]) {
      const existing = this.findUser(admin.id);
      if (existing) {
        const seededImages = this.demoAdminImages(admin.id);
        const existingImages = existing.images ?? [];
        if (
          seededImages.length > 0
          && (existingImages.length === 0 || existingImages.some(image => this.isLegacyDemoAdminImage(image)))
        ) {
          await this.saveUser({
            ...existing,
            images: seededImages
          });
        }
        continue;
      }
      await this.saveUser(AdminProfileSeedBuilder.buildDemoAdminUser(admin));
    }
  }

  async seedDemoAdminStores(): Promise<SeedAdminMenuCounterState<AdminNotificationCenterState, AdminMonitoringStateDto>> {
    const moderation = this.buildSeedDemoModerationStore();
    return await this.resetAndSeedAdminStores({
      moderation,
      notificationCenter: AdminNotificationsSeedBuilder.buildDefaultNotificationCenter(),
      monitoring: AdminMonitoringSeedBuilder.buildDefaultMonitoringState(),
      stats: AdminStatsSeedBuilder.buildSeedDemoStatsSnapshot(),
      params: AdminParamsSeedBuilder.buildDefaultParamsStore()
    });
  }

  async seedDemoAdminMenuCounters(
    seedState: SeedAdminMenuCounterState<AdminNotificationCenterState, AdminMonitoringStateDto>
  ): Promise<void> {
    const notificationCenter = seedState.notificationCenter;
    const monitoringState = seedState.monitoring;
    const adminJobs = this.countFailedNotificationRules(notificationCenter);
    const adminMetrics = this.countAlertMonitoringMetrics(monitoringState);
    for (const admin of [
      this.resolveDemoAdmin('admin-demo-ava'),
      this.resolveDemoAdmin('admin-demo-noel')
    ]) {
      const user = this.findUser(admin.id);
      if (!user) {
        continue;
      }
      const nextActivities = {
        game: Math.max(0, Math.trunc(Number(user.activities?.game) || 0)),
        chat: Math.max(0, Math.trunc(Number(user.activities?.chat) || 0)),
        invitations: Math.max(0, Math.trunc(Number(user.activities?.invitations) || 0)),
        events: Math.max(0, Math.trunc(Number(user.activities?.events) || 0)),
        hosting: Math.max(0, Math.trunc(Number(user.activities?.hosting) || 0)),
        tickets: Math.max(0, Math.trunc(Number(user.activities?.tickets) || 0)),
        feedback: Math.max(0, Math.trunc(Number(user.activities?.feedback) || 0)),
        adminJobs,
        adminMetrics
      };
      if (
        nextActivities.adminJobs === Math.max(0, Math.trunc(Number(user.activities?.adminJobs) || 0))
        && nextActivities.adminMetrics === Math.max(0, Math.trunc(Number(user.activities?.adminMetrics) || 0))
      ) {
        continue;
      }
      await this.saveUser({
        ...user,
        activities: nextActivities
      });
    }
  }

  async seedDemoAdminSupport(adminUserId?: string): Promise<void> {
    const admin = this.resolveDemoAdmin(adminUserId);
    const helpUser = this.findUser('u1');
    if (!helpUser) {
      return;
    }
    const now = new Date();
    const chat: ChatRecord & { ownerUserId?: string } = {
      id: `c-admin-service-help-${helpUser.id}`,
      avatar: helpUser.initials,
      title: `MyScoutee Support · ${helpUser.name}`,
      lastMessage: 'Please help me with what I see on MyScoutee.',
      lastSenderId: helpUser.id,
      memberIds: [admin.id, helpUser.id],
      unread: 1,
      dateIso: now.toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: admin.id
    };
    const existingChat = this.findChatsByUser(admin.id)
      .find(item => item.id === chat.id);
    const existingMessageIds = new Set(
      existingChat ? this.readChatMessages(existingChat).map(message => message.id) : []
    );
    for (let index = 0; index < this.demoAdminHelpTargets().length; index += 1) {
      const target = this.demoAdminHelpTargets()[index];
      if (!target) {
        continue;
      }
      const token = this.ensureAdminHelpToken({
        adminId: admin.id,
        userId: helpUser.id,
        targetKey: target.key,
        targetUrl: target.targetUrl
      });
      const helpUrl = this.location.prepareExternalUrl(`/admin/help/${encodeURIComponent(token)}`);
      const sentAt = new Date(now.getTime() + index * 1000);
      const sentAtIso = sentAt.toISOString();
      const message: ChatPopupMessage = {
        id: target.messageId,
        sender: helpUser.name,
        senderAvatar: {
          id: helpUser.id,
          initials: helpUser.initials,
          gender: helpUser.gender
        },
        text: target.text,
        time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        sentAtIso,
        mine: false,
        readBy: [],
        attachments: [{
          id: target.attachmentId,
          type: target.attachmentType,
          title: target.title,
          entityId: target.attachmentType === 'link' ? token : target.attachmentEntityId,
          assetType: target.assetType ?? null,
          ownerUserId: helpUser.id,
          subtitle: target.subtitle,
          description: target.description,
          url: helpUrl,
          previewUrl: target.previewUrl ?? null
        }]
      };
      if (existingMessageIds.has(target.messageId) && existingChat) {
        await this.updateChatMessage(existingChat, target.messageId, {
          attachments: message.attachments ?? []
        });
        continue;
      }
      await this.appendChatMessage(chat, message);
    }
  }

  async buildAndWriteAffinityGraphSnapshot(): Promise<void> {
    await this.affinityGraphSeed.buildAndWriteGraphSnapshot();
  }

  private async resetAndSeedAdminStores<
    TModeration,
    TNotification,
    TMonitoring,
    TStats,
    TParams
  >(
    stores: SeedAdminStores<TModeration, TNotification, TMonitoring, TStats, TParams>
  ): Promise<SeedAdminMenuCounterState<TNotification, TMonitoring>> {
    return await this.storeSeed.resetAndSeedAdminStores(stores);
  }

  private buildSeedDemoModerationStore(): AdminModerationStore {
    return AdminModerationSeedBuilder.buildSeedDemoModerationStore({
      userImageUrl: userId => this.firstUserImage(this.findUser(userId)),
      chatMessages: (ownerUserId, chatId) => this.demoChatMessages(ownerUserId, chatId)
    });
  }

  private demoChatMessages(ownerUserId: string, chatId: string): AdminChatMessageDto[] {
    const chat = this.findChatsByUser(ownerUserId)
      .find(item => item.id === chatId);
    if (!chat) {
      return [];
    }
    return this.readChatMessages(chat).map(message => ({
      id: message.id,
      sender: message.sender,
      senderUserId: message.senderAvatar.id,
      senderInitials: message.senderAvatar.initials,
      senderGender: message.senderAvatar.gender,
      text: message.text,
      time: message.time,
      sentAtIso: message.sentAtIso
    }));
  }

  private findUser(userId: string): UserDto | null {
    return this.usersSeed.queryUserById(userId);
  }

  private async saveUser(user: UserDto): Promise<UserDto> {
    return this.usersSeed.upsertUser(user);
  }

  private findChatsByUser(userId: string): ChatThreadRecord[] {
    return this.chatsSeed.queryChatItemsByUser(userId);
  }

  private readChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    return this.chatsSeed.queryChatMessages(chat);
  }

  private async appendChatMessage(chat: ChatRecord, message: ChatPopupMessage): Promise<ChatPopupMessage | null> {
    return this.chatsSeed.appendChatMessage(chat, message);
  }

  private async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: { attachments: ChatPopupMessage['attachments'] }
  ): Promise<ChatPopupMessage | null> {
    return this.chatsSeed.updateChatMessage(chat, messageId, mutation);
  }

  private ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    return this.shareTokensSeed.ensureAdminHelpToken(request);
  }

  private demoAdminHelpTargets(): AdminHelpTarget[] {
    return AdminHelpSeedBuilder.demoAdminHelpTargets();
  }

  private resolveDemoAdmin(adminUserId?: string): AdminUserDto {
    const id = `${adminUserId ?? ''}`.trim();
    if (id === 'admin-demo-noel') {
      return {
        id: 'admin-demo-noel',
        name: 'Noel Safety',
        initials: 'NS',
        email: 'noel.admin@myscoutee.local',
        images: this.demoAdminImages('admin-demo-noel')
      };
    }
    return {
      id: 'admin-demo-ava',
      name: 'Ava',
      initials: 'AM',
      email: 'ava.admin@myscoutee.local',
      images: this.demoAdminImages('admin-demo-ava')
    };
  }

  private demoAdminImages(adminUserId: string): string[] {
    return AdminProfileSeedBuilder.demoAdminImages(adminUserId);
  }

  private isLegacyDemoAdminImage(imageUrl: string | null | undefined): boolean {
    return AdminProfileSeedBuilder.isLegacyDemoAdminImage(imageUrl);
  }

  private firstUserImage(user: UserDto | null | undefined): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private countFailedNotificationRules(state: AdminNotificationCenterState | null | undefined): number {
    return (state?.rules ?? []).filter(rule => {
      const current = `${rule.runState?.currentStatus ?? ''}`.trim().toLowerCase();
      const last = `${rule.runState?.lastRunStatus ?? ''}`.trim().toLowerCase();
      return this.isFailureStatus(current) || this.isFailureStatus(last);
    }).length;
  }

  private countAlertMonitoringMetrics(state: AdminMonitoringStateDto | null | undefined): number {
    return (state?.categories ?? [])
      .flatMap(category => category.nodes ?? [])
      .flatMap(node => node.metrics ?? [])
      .filter(metric => metric.status === 'alert' || this.isFailureStatus(metric.key) || this.isFailureStatus(metric.labelKey))
      .reduce((total, metric) => total + Math.max(0, Math.trunc(Number(metric.value) || 0)), 0);
  }

  private isFailureStatus(value: string): boolean {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    return normalized.includes('failed')
      || normalized.includes('error')
      || normalized.includes('missed')
      || normalized.includes('timeout')
      || normalized.includes('hiany')
      || normalized.includes('hiba');
  }
}
