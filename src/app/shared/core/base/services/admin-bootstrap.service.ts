import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../interfaces/user.interface';
import type { ChatMessageMutation, ChatPopupMessage, ChatRecord } from '../models/chat.model';
import type { ChatThreadRecord } from '../models/chats.model';
import { LocalAdminBootstrapService } from '../../local/services/admin-bootstrap.service';

export interface AdminBootstrapStoresSeed<
  TModeration = unknown,
  TNotification = unknown,
  TMonitoring = unknown,
  TStats = unknown,
  TParams = unknown
> {
  moderation: TModeration;
  notificationCenter: TNotification;
  monitoring: TMonitoring;
  stats: TStats;
  params: TParams;
}

export interface AdminBootstrapMenuSeedState<TNotification = unknown, TMonitoring = unknown> {
  notificationCenter: TNotification;
  monitoring: TMonitoring;
}

@Injectable({
  providedIn: 'root'
})
export class AdminBootstrapService {
  private readonly localService = inject(LocalAdminBootstrapService);

  async whenUsersReady(): Promise<void> {
    await this.localService.whenUsersReady();
  }

  async initHelpCenter(): Promise<boolean> {
    return await this.localService.initHelpCenter();
  }

  async initIdeaPosts(): Promise<boolean> {
    return await this.localService.initIdeaPosts();
  }

  initUsers(): UserDto[] {
    return this.localService.initUsers();
  }

  initUserRatings(seedUsers?: readonly UserDto[]): void {
    this.localService.initUserRatings(seedUsers);
  }

  initChats(): void {
    this.localService.initChats();
  }

  async buildAndWriteAffinityGraphSnapshot(): Promise<void> {
    await this.localService.buildAndWriteAffinityGraphSnapshot();
  }

  async resetAndSeedAdminStores<
    TModeration,
    TNotification,
    TMonitoring,
    TStats,
    TParams
  >(
    stores: AdminBootstrapStoresSeed<TModeration, TNotification, TMonitoring, TStats, TParams>
  ): Promise<AdminBootstrapMenuSeedState<TNotification, TMonitoring>> {
    return await this.localService.resetAndSeedAdminStores(stores);
  }

  findUser(userId: string): UserDto | null {
    return this.localService.findUser(userId);
  }

  async saveUser(user: UserDto): Promise<UserDto> {
    return await this.localService.saveUser(user);
  }

  findChatsByUser(userId: string): ChatThreadRecord[] {
    return this.localService.findChatsByUser(userId);
  }

  readChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    return this.localService.readChatMessages(chat);
  }

  async appendChatMessage(chat: ChatRecord, message: ChatPopupMessage): Promise<ChatPopupMessage | null> {
    return await this.localService.appendChatMessage(chat, message);
  }

  async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: ChatMessageMutation
  ): Promise<ChatPopupMessage | null> {
    return await this.localService.updateChatMessage(chat, messageId, mutation);
  }

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    return this.localService.ensureAdminHelpToken(request);
  }
}
