import type { ChatRecord, ChatThreadRecord } from '../entity/chat.entity';
import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type { ChatMessageMutation, ChatPopupMessage } from '../../../contracts/chat.interface';

import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalShareTokensRepository } from '../repositories/share-tokens.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalUsersMapper } from '../mappers';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminSupportSessionService {
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly shareTokensRepository = inject(LocalShareTokensRepository);

  findUser(userId: string): UserDto | null {
    return this.usersRepository.queryUserById(userId);
  }

  async saveUser(user: UserDto): Promise<UserDto> {
    const saved = LocalUsersMapper.toDto(
      this.usersRepository.upsertUser(LocalUsersMapper.toRecord(user))
    );
    await this.usersRepository.flushToIndexedDb();
    return saved;
  }

  findChatsByUser(userId: string): ChatThreadRecord[] {
    return this.chatsRepository.queryChatItemsByUser(userId);
  }

  readChatMessages(chat: ChatRecord): ChatPopupMessage[] {
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

  supportChatExists(adminId: string, userId: string): boolean {
    return Boolean(this.findSupportChat(adminId, userId));
  }

  supportChatUnread(adminId: string, userId: string): number {
    const chat = this.findSupportChat(adminId, userId);
    return Math.max(0, Math.trunc(Number(chat?.unread) || 0));
  }

  ensureAdminHelpToken(request: {
    adminId: string;
    userId: string;
    targetKey: string;
    targetUrl: string;
  }): string {
    return this.shareTokensRepository.ensureAdminHelpToken(request);
  }

  private findSupportChat(adminId: string, userId: string): ChatThreadRecord | null {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedAdminId = `${adminId ?? ''}`.trim();
    if (!normalizedUserId || !normalizedAdminId) {
      return null;
    }
    return this.chatsRepository.queryChatItemsByUser(normalizedAdminId)
      .find(item => item.id === `c-support-admin-${normalizedUserId}`) ?? null;
  }
}
