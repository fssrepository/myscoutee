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

  settings(userId: string, baseUrl: string, admin = false): IntegrationSettingsDto {
    let user = this.requireUser(userId);
    if (admin && !user.admin) throw new Error('admin.api.denied');
    if (!admin && !user.affiliateCode) {
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
      affiliate: { url: `/entry?affiliate=${user.affiliateCode}`, registered: user.affiliateRegistrations?.length ?? 0, revenue: user.affiliateRevenue ?? { currencies: {}, purchases: 0, eventBookings: 0 } },
      participants: { registered: 0, imported: 0 },
      maxActiveTokens: LocalIntegrationRepository.MAX_ACTIVE_TOKENS,
      maxBatchSize: LocalIntegrationRepository.MAX_BATCH_SIZE,
      tokens: this.activeTokens(this.requireUser(userId), admin).map(({ value: _value, ...token }) => token)
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

  recordPayment(userId: string, paymentId: string, currency: string, amount: number, refunded = 0, eventBooking = true): void {
    currency = currency.trim().toUpperCase();
    if (!paymentId || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || !Number.isFinite(refunded)) return;
    const grossMinor = Math.max(0, Math.round(amount * 100));
    const refundMinor = Math.max(0, Math.min(grossMinor, Math.round(refunded * 100)));
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const payer = table.byId[userId];
      const previous = payer?.affiliatePayments?.[paymentId];
      const ownerId = previous?.ownerId ?? payer?.affiliateReferrerUserId;
      const owner = ownerId ? table.byId[ownerId] : null;
      if (!payer || !owner || owner.id === userId || (previous && previous.currency !== currency)) return state;
      const revenue = owner.affiliateRevenue ?? { currencies: {}, purchases: 0, eventBookings: 0 };
      const totals = revenue.currencies[currency] ?? { gross: 0, refunded: 0, net: 0 };
      const gross = (Math.round(totals.gross * 100) + grossMinor - Math.round((previous?.gross ?? 0) * 100)) / 100;
      const refunds = (Math.round(totals.refunded * 100) + refundMinor - Math.round((previous?.refunded ?? 0) * 100)) / 100;
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [userId]: { ...payer, affiliatePayments: { ...payer.affiliatePayments, [paymentId]: {
          ownerId: owner.id, currency, gross: grossMinor / 100, refunded: refundMinor / 100, eventBooking
        } } },
        [owner.id]: { ...owner, affiliateRevenue: {
          currencies: { ...revenue.currencies, [currency]: { gross, refunded: refunds, net: Math.round((gross - refunds) * 100) / 100 } },
          purchases: revenue.purchases + Number(grossMinor > 0) - Number((previous?.gross ?? 0) > 0),
          eventBookings: revenue.eventBookings + Number(grossMinor > 0 && eventBooking) - Number((previous?.gross ?? 0) > 0 && previous?.eventBooking)
        } }
      } } };
    });
  }

  refundPayment(paymentId: string): void {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    for (const id of users.ids) {
      const payment = users.byId[id].affiliatePayments?.[paymentId];
      if (payment) {
        this.recordPayment(id, paymentId, payment.currency, payment.gross, payment.gross, payment.eventBooking);
        return;
      }
    }
  }

  createToken(
    userId: string,
    name: string,
    expiresInDays: number, admin = false
  ): IntegrationTokenCreatedDto {
    const user = this.requireUser(userId);
    if (admin && !user.admin) throw new Error('admin.api.denied');
    const activeTokens = this.activeTokens(user, admin);
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
      id, scope: admin ? 'admin-client' : 'integration',
      name: normalizedName,
      prefix: value.slice(0, 12),
      value,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
      claimedAt: null,
      claimedAddress: null,
      lastUsedAt: null
    };
    this.writeTokens(user.id, [...(user.integrationTokens ?? []), record]);
    const { value: _storedValue, ...token } = record;
    return { token, value };
  }

  revokeToken(userId: string, tokenId: string, admin = false): void {
    const user = this.requireUser(userId);
    if (admin && !user.admin) throw new Error('admin.api.denied');
    const normalizedId = tokenId.trim();
    this.writeTokens(
      user.id,
      (user.integrationTokens ?? []).filter(token => token.id !== normalizedId || (token.scope ?? 'integration') !== (admin ? 'admin-client' : 'integration'))
    );
  }

  private activeTokens(user: UserRecord, admin = false): LocalIntegrationTokenRecord[] {
    const now = Date.now();
    return (user.integrationTokens ?? [])
      .filter(token => Date.parse(token.expiresAt) > now && (token.scope ?? 'integration') === (admin ? 'admin-client' : 'integration'))
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
