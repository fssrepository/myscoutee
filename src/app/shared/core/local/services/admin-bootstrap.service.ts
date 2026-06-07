import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../base/interfaces/user.interface';
import type { ChatMessageMutation, ChatPopupMessage, ChatRecord } from '../../base/models/chat.model';
import type { ChatThreadRecord } from '../../base/models/chats.model';
import { LocalAdminAffinityGraphRepository } from '../repositories/admin-affinity-graph.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import {
  LocalAdminStoreSeedService,
  type LocalAdminMenuCounterSeedState,
  type LocalAdminStoresSeed
} from './admin-store-seed.service';
import { LocalAdminSupportSessionService } from './admin-support-session.service';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminBootstrapService {
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly usersRatingsRepository = inject(LocalUsersRatingsRepository);
  private readonly affinityGraphRepository = inject(LocalAdminAffinityGraphRepository);
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly storeSeed = inject(LocalAdminStoreSeedService);
  private readonly supportSession = inject(LocalAdminSupportSessionService);
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

  async resetAndSeedAdminStores<
    TModeration,
    TNotification,
    TMonitoring,
    TStats,
    TParams
  >(
    stores: LocalAdminStoresSeed<TModeration, TNotification, TMonitoring, TStats, TParams>
  ): Promise<LocalAdminMenuCounterSeedState<TNotification, TMonitoring>> {
    return await this.storeSeed.resetAndSeedAdminStores(stores);
  }

  findUser(userId: string): UserDto | null {
    return this.supportSession.findUser(userId);
  }

  async saveUser(user: UserDto): Promise<UserDto> {
    return await this.supportSession.saveUser(user);
  }

  findChatsByUser(userId: string): ChatThreadRecord[] {
    return this.supportSession.findChatsByUser(userId);
  }

  readChatMessages(chat: ChatRecord): ChatPopupMessage[] {
    return this.supportSession.readChatMessages(chat);
  }

  async appendChatMessage(chat: ChatRecord, message: ChatPopupMessage): Promise<ChatPopupMessage | null> {
    return await this.supportSession.appendChatMessage(chat, message);
  }

  async updateChatMessage(
    chat: ChatRecord,
    messageId: string,
    mutation: ChatMessageMutation
  ): Promise<ChatPopupMessage | null> {
    return await this.supportSession.updateChatMessage(chat, messageId, mutation);
  }

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    return this.supportSession.ensureAdminHelpToken(request);
  }
}
