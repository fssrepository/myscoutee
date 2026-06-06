import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../interfaces/user.interface';
import type { ChatMessageMutation, ChatPopupMessage, ChatRecord } from '../models/chat.model';
import type { ChatThreadRecord } from '../models/chats.model';
import { LocalAdminDemoDataService } from '../../local/services/admin-demo-data.service';

@Injectable({
  providedIn: 'root'
})
export class AdminDemoDataService {
  private readonly localService = inject(LocalAdminDemoDataService);

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

  async clearAdminStores(): Promise<void> {
    await this.localService.clearAdminStores();
  }

  async readAdminNotificationCenter<T>(): Promise<T | null> {
    return await this.localService.readAdminNotificationCenter<T>();
  }

  async readAdminMonitoring<T>(): Promise<T | null> {
    return await this.localService.readAdminMonitoring<T>();
  }

  async writeAdminModerationStore<T>(store: T): Promise<void> {
    await this.localService.writeAdminModerationStore(store);
  }

  async writeAdminNotificationCenter<T>(store: T): Promise<void> {
    await this.localService.writeAdminNotificationCenter(store);
  }

  async writeAdminMonitoring<T>(store: T): Promise<void> {
    await this.localService.writeAdminMonitoring(store);
  }

  async writeAdminStats<T>(store: T): Promise<void> {
    await this.localService.writeAdminStats(store);
  }

  async writeAdminParams<T>(store: T): Promise<void> {
    await this.localService.writeAdminParams(store);
  }

  queryUserById(userId: string): UserDto | null {
    return this.localService.queryUserById(userId);
  }

  async upsertUser(user: UserDto): Promise<UserDto> {
    return await this.localService.upsertUser(user);
  }

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    return this.localService.queryChatItemsByUser(userId);
  }

  queryChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    return this.localService.queryChatMessages(chat);
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

  async upsertSupportChatMessage(
    chat: ChatThreadRecord,
    message: ChatPopupMessage,
    unreadForOwner: boolean
  ): Promise<void> {
    await this.localService.upsertSupportChatMessage(chat, message, unreadForOwner);
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
