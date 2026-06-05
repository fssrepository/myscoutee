import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../base/interfaces/user.interface';
import { LocalMemoryDb } from '../../base/db';
import type { ChatMessageMutation, ChatPopupMessage, ChatRecord } from '../../base/models/chat.model';
import type { ChatThreadRecord } from '../../base/models/chats.model';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';
import { LocalAdminAffinityGraphRepository } from '../repositories/admin-affinity-graph.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalShareTokensRepository } from '../repositories/share-tokens.repository';
import { LocalUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminDemoDataService {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly usersRatingsRepository = inject(LocalUsersRatingsRepository);
  private readonly affinityGraphRepository = inject(LocalAdminAffinityGraphRepository);
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly shareTokensRepository = inject(LocalShareTokensRepository);
  private readonly helpCenterService = inject(LocalHelpCenterService);
  private readonly ideaPostsService = inject(LocalIdeaPostsService);

  async whenUsersReady(): Promise<void> {
    await this.usersRepository.whenReady();
  }

  async initHelpCenter(): Promise<boolean> {
    return await this.helpCenterService.init();
  }

  async initIdeaPosts(): Promise<boolean> {
    return await this.ideaPostsService.init();
  }

  initUsers(): UserDto[] {
    return this.usersRepository.init();
  }

  initUserRatings(seedUsers?: readonly UserDto[]): void {
    this.usersRatingsRepository.init(seedUsers);
  }

  initChats(): void {
    this.chatsRepository.init();
  }

  async buildAndWriteAffinityGraphSnapshot(): Promise<void> {
    await this.affinityGraphRepository.buildAndWriteGraphSnapshot();
  }

  async clearAdminStores(): Promise<void> {
    await Promise.all([
      this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminNotificationRules),
      this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring),
      this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats),
      this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminParams),
      this.memoryDb.deleteIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminModeration)
    ]);
  }

  async readAdminNotificationCenter<T>(): Promise<T | null> {
    return await this.memoryDb.readIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminNotificationRules);
  }

  async readAdminMonitoring<T>(): Promise<T | null> {
    return await this.memoryDb.readIndexedDbTableEntry<T>(APP_INDEXED_DB_KEYS.adminMonitoring);
  }

  async writeAdminModerationStore<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminModeration, store);
  }

  async writeAdminNotificationCenter<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminNotificationRules, store);
  }

  async writeAdminMonitoring<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminMonitoring, store);
  }

  async writeAdminStats<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminStats, store);
  }

  async writeAdminParams<T>(store: T): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.adminParams, store);
  }

  queryUserById(userId: string): UserDto | null {
    return this.usersRepository.queryUserById(userId);
  }

  async upsertUser(user: UserDto): Promise<UserDto> {
    const saved = this.usersRepository.upsertUser(user);
    await this.usersRepository.flushToIndexedDb();
    return saved;
  }

  queryChatItemsByUser(userId: string): ChatThreadRecord[] {
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  queryChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    return this.chatsRepository.queryChatMessages(chat);
  }

  async appendChatMessage(chat: ChatRecord, message: ChatPopupMessage): Promise<ChatPopupMessage | null> {
    const saved = this.chatsRepository.appendChatMessage(chat, message);
    await this.chatsRepository.flushToIndexedDb();
    return saved;
  }

  async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: ChatMessageMutation
  ): Promise<ChatPopupMessage | null> {
    const saved = this.chatsRepository.updateChatMessage(chat, messageId, mutation);
    await this.chatsRepository.flushToIndexedDb();
    return saved;
  }

  async upsertSupportChatMessage(
    chat: ChatThreadRecord,
    message: ChatPopupMessage,
    unreadForOwner: boolean
  ): Promise<void> {
    this.chatsRepository.upsertSupportChatMessage(chat, message, unreadForOwner);
    await this.chatsRepository.flushToIndexedDb();
  }

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    return this.shareTokensRepository.ensureAdminHelpToken(request);
  }
}
