import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../../contracts/integration.interface';
import type { LocalIntegrationTokenRecord } from '../entity/integration.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';

@Injectable({ providedIn: 'root' })
export class LocalIntegrationRepository {
  private static readonly MAX_ACTIVE_TOKENS = 3;
  private static readonly MAX_BATCH_SIZE = 1000;
  private readonly memoryDb = inject(LocalMemoryDb);

  whenReady(): Promise<void> {
    return this.memoryDb.whenReady();
  }

  flushToIndexedDb(): Promise<void> {
    return this.memoryDb.flushToIndexedDb();
  }

  settings(userId: string, baseUrl: string): IntegrationSettingsDto {
    let user = this.requireUser(userId);
    if (!user.affiliateCode) {
      const code = globalThis.crypto.randomUUID();
      this.memoryDb.write(state => ({ ...state, [USERS_TABLE_NAME]: {
        ...state[USERS_TABLE_NAME], byId: { ...state[USERS_TABLE_NAME].byId,
          [userId]: { ...state[USERS_TABLE_NAME].byId[userId], affiliateCode: code }
        }
      }}));
      user = this.requireUser(userId);
    }
    return {
      baseUrl,
      affiliate: { url: `/entry?affiliate=${user.affiliateCode}`, registered: user.affiliateRegistrations?.length ?? 0 },
      participants: { registered: 0, imported: 0 },
      maxActiveTokens: LocalIntegrationRepository.MAX_ACTIVE_TOKENS,
      maxBatchSize: LocalIntegrationRepository.MAX_BATCH_SIZE,
      tokens: this.activeTokens(this.requireUser(userId)).map(({ value: _value, ...token }) => token)
    };
  }

  recordRegistration(userId: string, code: string | undefined): void {
    if (!code || !/^[a-f0-9-]{36}$/.test(code)) return;
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const user = table.byId[userId];
      const owner = table.ids.map(id => table.byId[id]).find(item => item.affiliateCode === code && !item.deletedAtIso);
      if (!user || !owner || owner.id === userId || user.affiliateReferrerUserId) return state;
      const registrations = owner.affiliateRegistrations ?? [];
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [userId]: { ...user, affiliateReferrerUserId: owner.id },
        [owner.id]: { ...owner, affiliateRegistrations: registrations.some(item => item.userId === userId)
          ? registrations : [...registrations, { userId, registeredAtIso: new Date().toISOString() }] }
      }}};
    });
  }

  createToken(
    userId: string,
    name: string,
    expiresInDays: number
  ): IntegrationTokenCreatedDto {
    const user = this.requireUser(userId);
    const activeTokens = this.activeTokens(user);
    if (activeTokens.length >= LocalIntegrationRepository.MAX_ACTIVE_TOKENS) {
      throw new Error('integration.token.limit.reached');
    }
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error('integration.token.name.required');
    }
    const days = Math.max(1, Math.min(365, Math.trunc(expiresInDays)));
    const now = new Date();
    const id = this.uuid();
    const value = `msc_${id.replaceAll('-', '')}_${this.uuid().replaceAll('-', '')}`;
    const record: LocalIntegrationTokenRecord = {
      id,
      name: normalizedName,
      prefix: value.slice(0, 12),
      value,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
      claimedAt: null,
      claimedAddress: null,
      lastUsedAt: null
    };
    this.writeTokens(user.id, [...activeTokens, record]);
    const { value: _storedValue, ...token } = record;
    return { token, value };
  }

  revokeToken(userId: string, tokenId: string): void {
    const user = this.requireUser(userId);
    const normalizedId = tokenId.trim();
    this.writeTokens(
      user.id,
      this.activeTokens(user).filter(token => token.id !== normalizedId)
    );
  }

  private activeTokens(user: UserRecord): LocalIntegrationTokenRecord[] {
    const now = Date.now();
    return (user.integrationTokens ?? [])
      .filter(token => Date.parse(token.expiresAt) > now)
      .map(token => ({ ...token }));
  }

  private writeTokens(
    userId: string,
    integrationTokens: LocalIntegrationTokenRecord[]
  ): void {
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const user = table.byId[userId];
      if (!user) {
        throw new Error('integration.user.missing');
      }
      return {
        ...state,
        [USERS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [userId]: {
              ...user,
              integrationTokens: integrationTokens.map(token => ({ ...token }))
            }
          }
        }
      };
    });
  }

  private requireUser(userId: string): UserRecord {
    const normalizedId = userId.trim();
    const user = this.memoryDb.read()[USERS_TABLE_NAME].byId[normalizedId];
    if (!user) {
      throw new Error('integration.user.missing');
    }
    return user;
  }

  private uuid(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
