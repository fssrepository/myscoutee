import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';
import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../../contracts/integration.interface';
import type { LocalIntegrationTokenRecord } from '../entity/integration.entity';
import { USERS_TABLE_NAME, type UserRecord } from '../entity/user.entity';
import type { PricingCancellationPolicy } from '../../../contracts/pricing.interface';
import type { PaymentRefundPreviewDto } from '../../../contracts/payment-method.interface';

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

  externalInvite(ownerUserId: string, ownerType: 'event' | 'community', entityId: string): {url: string} {
    const settings = this.settings(ownerUserId, '/api/integrations/v1');
    const owner = this.requireUser(ownerUserId);
    let invite = owner.externalInvites?.find(item => item.ownerType === ownerType && item.entityId === entityId);
    if (!invite) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      invite = {ownerType, entityId, token: btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), createdAtIso: new Date().toISOString()};
      const next = invite;
      this.memoryDb.write(state => ({...state, [USERS_TABLE_NAME]: {...state[USERS_TABLE_NAME], byId: {
        ...state[USERS_TABLE_NAME].byId, [ownerUserId]: {...state[USERS_TABLE_NAME].byId[ownerUserId],
          externalInvites: [...(state[USERS_TABLE_NAME].byId[ownerUserId].externalInvites ?? []), next]}
      }}}));
    }
    return {url: `/game?${settings.affiliate.url.split('?')[1]}&partnerInvite=${invite.token}`};
  }

  findExternalInvite(token: string) {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    for (const id of users.ids) {
      const owner = users.byId[id];
      if (owner.deletedAtIso) continue;
      const invite = owner.externalInvites?.find(item => item.token === token);
      if (invite) return {...invite, ownerUserId: id};
    }
    return null;
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

  recordPayment(userId: string, paymentId: string, currency: string, amount: number, refunded = 0, eventBooking = true, sourceId?: string, recipientUserId?: string, bookingStartAtIso?: string, cancellationPolicy?: PricingCancellationPolicy, provider?: string): void {
    currency = currency.trim().toUpperCase();
    if (!paymentId || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || !Number.isFinite(refunded)) return;
    const grossMinor = Math.max(0, Math.round(amount * 100));
    const requestedRefundMinor = Math.max(0, Math.min(grossMinor, Math.round(refunded * 100)));
    this.memoryDb.write(state => {
      const table = { ...state[USERS_TABLE_NAME], byId: { ...state[USERS_TABLE_NAME].byId } };
      const payer = table.byId[userId];
      const previous = payer?.affiliatePayments?.[paymentId];
      const paymentProvider = previous?.provider ?? provider?.trim().toLowerCase() ?? 'dummy';
      const ownerId = paymentProvider === 'cash' ? null : previous?.ownerId ?? payer?.affiliateReferrerUserId;
      const owner = ownerId ? table.byId[ownerId] : null;
      if (!payer || (previous && (previous.currency !== currency || previous.gross !== grossMinor / 100))) return state;
      const refundMinor = Math.max(requestedRefundMinor, Math.round((previous?.refunded ?? 0) * 100));
      const refundDelta = refundMinor / 100 - (previous?.refunded ?? 0);
      const nextPayment = {
        ...previous, provider: paymentProvider, ownerId: owner?.id ?? '', currency, gross: grossMinor / 100,
        refunded: refundMinor / 100, eventBooking, sourceId: sourceId ?? previous?.sourceId,
        recipientUserId: recipientUserId ?? previous?.recipientUserId,
        createdAtIso: previous?.createdAtIso ?? new Date().toISOString(),
        bookingStartAtIso: previous ? previous.bookingStartAtIso : bookingStartAtIso,
        cancellationPolicy: previous ? previous.cancellationPolicy : cancellationPolicy ? structuredClone(cancellationPolicy) : undefined,
        eventRefundEligible: refundMinor >= grossMinor ? false : previous?.eventRefundEligible,
        refundRequest: previous?.refundRequest && refundMinor >= Math.round(previous.refundRequest.target * 100)
          ? { ...previous.refundRequest, status: 'approved' as const } : previous?.refundRequest,
        refundOperations: refundDelta > 0 ? [...(previous?.refundOperations ?? []), {
          id: `refund:${paymentId}:${refundMinor}`, amount: Math.round(refundDelta * 100) / 100,
          createdAtIso: new Date().toISOString()
        }] : previous?.refundOperations
      };
      const nextPayer = { ...payer, affiliatePayments: { ...payer.affiliatePayments, [paymentId]: nextPayment } };
      if (previous?.refundRequest?.status === 'pending' && nextPayment.refundRequest?.status === 'approved') {
        const recipient = table.byId[nextPayment.recipientUserId ?? ''];
        if (recipient) {
          // Include this update in the same local transaction as the financial projection.
          table.byId = { ...table.byId, [recipient.id]: { ...recipient, activities: { ...recipient.activities,
            paymentRefundsPending: Math.max(0, (recipient.activities.paymentRefundsPending ?? 0) - 1) } } };
        }
      }
      if (!owner || owner.id === userId) return { ...state, [USERS_TABLE_NAME]: {
        ...table, byId: { ...table.byId, [userId]: nextPayer }
      } };
      const revenue = owner.affiliateRevenue ?? { currencies: {}, purchases: 0, eventBookings: 0 };
      const totals = revenue.currencies[currency] ?? { gross: 0, refunded: 0, net: 0 };
      const gross = (Math.round(totals.gross * 100) + grossMinor - Math.round((previous?.gross ?? 0) * 100)) / 100;
      const refunds = (Math.round(totals.refunded * 100) + refundMinor - Math.round((previous?.refunded ?? 0) * 100)) / 100;
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [userId]: nextPayer,
        [owner.id]: { ...table.byId[owner.id], affiliateRevenue: {
          currencies: { ...revenue.currencies, [currency]: { gross, refunded: refunds, net: Math.round((gross - refunds) * 100) / 100 } },
          purchases: revenue.purchases + Number(grossMinor > 0) - Number((previous?.gross ?? 0) > 0),
          eventBookings: revenue.eventBookings + Number(grossMinor > 0 && eventBooking) - Number((previous?.gross ?? 0) > 0 && previous?.eventBooking)
        } }
      } } };
    });
  }

  recordCashReceipt(recipientId: string, request: import('../../../contracts/payment-method.interface').CashReceiptRequestDto): import('../../../contracts/payment-method.interface').PaymentHistoryItemDto {
    if (!/^[a-f0-9-]{36}$/i.test(request.requestId) || !Number.isFinite(request.amount) || request.amount <= 0
      || request.amount > 1_000_000_000 || Math.abs(request.amount * 100 - Math.round(request.amount * 100)) > 0.000001
      || !/^[A-Z]{3}$/.test(request.currency) || request.note.length > 1000 || request.payerUserId === recipientId) {
      throw new Error('Invalid cash receipt');
    }
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    const payer = users.byId[request.payerUserId];
    const recipient = users.byId[recipientId];
    if (!payer || !recipient || payer.deletedAtIso || recipient.deletedAtIso
      || (payer.workspaceGroupId ?? null) !== (recipient.workspaceGroupId ?? null)) throw new Error('Member unavailable');
    const id = `cash:${recipientId}:${request.requestId}`;
    const note = request.note.trim();
    const previousPayer = users.ids.find(userId => users.byId[userId].affiliatePayments?.[id]);
    if (previousPayer && previousPayer !== payer.id) throw new Error('Receipt request already used');
    const previous = payer.affiliatePayments?.[id];
    if (previous && (previous.recipientUserId !== recipientId || previous.gross !== request.amount
      || previous.currency !== request.currency || previous.receiptNote !== note)) throw new Error('Receipt request already used');
    if (!previous) {
      this.recordPayment(payer.id, id, request.currency, request.amount, 0, false, id, recipientId, undefined, undefined, 'cash');
      this.memoryDb.write(state => {
        const table = state[USERS_TABLE_NAME];
        const currentPayer = table.byId[payer.id];
        const payment = currentPayer.affiliatePayments![id];
        return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId, [payer.id]: {
          ...currentPayer, affiliatePayments: { ...currentPayer.affiliatePayments, [id]: {
            ...payment, manualCash: true, receiptNote: note, receiptPayerName: payer.name, receiptRecipientName: recipient.name
          } }
        } } } };
      });
    }
    return this.paymentHistory(recipientId).find(item => item.id === id)!;
  }

  paymentHistory(userId: string): import('../../../contracts/payment-method.interface').PaymentHistoryItemDto[] {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    return users.ids.flatMap(payerId => Object.entries(users.byId[payerId].affiliatePayments ?? {}).flatMap(([id, payment]) => {
      if (!payment.sourceId || (payerId !== userId && payment.recipientUserId !== userId)) return [];
      const direction = payerId === userId ? 'expense' as const : 'income' as const;
      const base = { sourceId: payment.sourceId, checkoutSessionId: id, provider: payment.provider ?? 'dummy', currency: payment.currency,
        recipientUserId: payment.recipientUserId, bookingStatus: payment.refunded >= payment.gross ? 'cancelled' : 'joined',
        canRequestRefund: false, canApproveRefund: false };
      const refundPreview = payment.manualCash ? null : this.refundPreview(payment);
      return [{ ...base, id, direction, amount: payment.gross, status: 'approved', auditKind: 'payment',
          fulfillmentKind: payment.manualCash ? 'cash-receipt' : null,
          note: payment.receiptNote, counterpartyName: direction === 'income' ? payment.receiptPayerName : payment.receiptRecipientName,
          refundPreview, canRequestRefund: payerId === userId && !payment.refundRequest
            && payment.refunded === 0 && (refundPreview?.refundableAmount ?? 0) > 0,
          createdAtIso: payment.createdAtIso ?? '' },
        ...(payment.refundOperations ?? []).map(refund => ({ ...base, id: refund.id,
          direction: direction === 'expense' ? 'income' as const : 'expense' as const,
          amount: refund.amount, status: 'refunded', auditKind: 'refund', refundRequestStatus: 'approved' as const, createdAtIso: refund.createdAtIso })),
        ...(payment.refundRequest?.status === 'pending' ? [{ ...base, id: payment.refundRequest.id,
          direction: direction === 'expense' ? 'income' as const : 'expense' as const,
          amount: payment.refundRequest.amount, status: 'refund_requested', auditKind: 'refund',
          refundRequestStatus: 'pending' as const, canApproveRefund: payment.recipientUserId === userId,
          createdAtIso: payment.refundRequest.requestedAtIso }] : [])];
    }));
  }

  requestPolicyRefund(userId: string, paymentId: string): boolean {
    const payment = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId]?.affiliatePayments?.[paymentId];
    if (!payment) return false;
    if (payment.manualCash) throw new Error('Cash receipts have no booking refund.');
    const preview = this.refundPreview(payment);
    if (payment.refundRequest || payment.refunded > 0 || preview.refundableAmount <= 0) {
      throw new Error('This payment can no longer be refunded.');
    }
    this.requestPaymentRefund(userId, paymentId, preview.refundableAmount);
    return true;
  }

  private refundPreview(payment: NonNullable<UserRecord['affiliatePayments']>[string]): PaymentRefundPreviewDto {
    const paid = payment.gross;
    const startText = payment.bookingStartAtIso ?? '';
    const start = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(startText) ? startText : `${startText}Z`);
    const eligible = (payment.cancellationPolicy?.enabled ? payment.cancellationPolicy.rules : [])
      .map(rule => {
        const deadline = new Date(start.getTime());
        const offset = Math.max(0, Math.trunc(Number(rule.offsetValue) || 0));
        if (rule.offsetUnit === 'months') {
          const day = deadline.getUTCDate();
          deadline.setUTCDate(1);
          deadline.setUTCMonth(deadline.getUTCMonth() - offset);
          const lastDay = new Date(Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth() + 1, 0)).getUTCDate();
          deadline.setUTCDate(Math.min(day, lastDay));
        } else if (rule.offsetUnit === 'hours') deadline.setUTCHours(deadline.getUTCHours() - offset);
        else deadline.setUTCDate(deadline.getUTCDate() - offset * (rule.offsetUnit === 'weeks' ? 7 : 1));
        return { rule, deadline: deadline.getTime() };
      }).filter(item => Number.isFinite(item.deadline) && Date.now() <= item.deadline)
      .sort((left, right) => left.deadline - right.deadline)[0]?.rule;
    const value = Math.max(0, Number(eligible?.refundValue) || 0);
    const amount = !eligible || eligible.refundKind === 'none' ? 0
      : eligible.refundKind === 'full' ? paid
      : eligible.refundKind === 'fixed_amount' ? Math.min(paid, value)
      : paid * Math.min(100, value) / 100;
    const refundableAmount = Math.round(amount * 100) / 100;
    return { paidAmount: paid, refundableAmount, retainedAmount: Math.round((paid - refundableAmount) * 100) / 100,
      currency: payment.currency, status: refundableAmount <= 0 ? 'not_eligible' : refundableAmount >= paid ? 'full' : 'partial',
      ruleId: eligible?.id, ruleOffsetUnit: eligible?.offsetUnit, ruleOffsetValue: eligible?.offsetValue,
      refundKind: eligible?.refundKind, refundValue: eligible?.refundValue };
  }

  markEventTermsChanged(sourceId: string): string[] {
    const affected: string[] = [];
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const byId = { ...table.byId };
      for (const id of table.ids) {
        const user = byId[id];
        const payments = { ...user.affiliatePayments };
        let changed = false;
        for (const [key, payment] of Object.entries(payments)) {
          if (payment.sourceId !== sourceId || payment.refunded >= payment.gross) continue;
          payments[key] = { ...payment, eventRefundEligible: true };
          changed = true;
        }
        if (changed) { affected.push(id); byId[id] = { ...user, affiliatePayments: payments }; }
      }
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId } };
    });
    return affected;
  }

  cancelEventPayments(sourceId: string, userId?: string, adminRemoval = false): void {
    const table = this.memoryDb.read()[USERS_TABLE_NAME];
    const affected = table.ids.filter(id => !userId || id === userId).flatMap(id =>
      Object.entries(table.byId[id].affiliatePayments ?? {})
        .filter(([, payment]) => payment.sourceId === sourceId && (!userId || adminRemoval || payment.eventRefundEligible))
        .map(([paymentId]) => paymentId));
    if (userId && !adminRemoval && affected.length === 0) throw new Error('No changed-terms cancellation is available.');
    for (const paymentId of affected) {
      if (userId && !adminRemoval) this.requestChangedTermsRefund(userId, paymentId);
      else this.refundPayment(paymentId);
    }
  }

  private requestChangedTermsRefund(userId: string, paymentId: string): void {
    const payment = this.memoryDb.read()[USERS_TABLE_NAME].byId[userId]?.affiliatePayments?.[paymentId];
    if (!payment?.eventRefundEligible || payment.refunded >= payment.gross) throw new Error('No changed-terms cancellation is available.');
    this.requestPaymentRefund(userId, paymentId, payment.gross);
  }

  private requestPaymentRefund(userId: string, paymentId: string, target: number): void {
    this.memoryDb.write(state => {
      const table = state[USERS_TABLE_NAME];
      const payer = table.byId[userId];
      const payment = payer?.affiliatePayments?.[paymentId];
      if (!payment || payment.refunded >= target) throw new Error('This payment can no longer be refunded.');
      if (payment.refundRequest?.status === 'pending' && payment.refundRequest.target === target) return state;
      const recipient = table.byId[payment.recipientUserId ?? ''];
      if (!recipient || recipient.id === userId) throw new Error('This payment has no separate recipient.');
      const refundRequest = { id: `refund:${paymentId}:${Math.round(target * 100)}`,
        amount: Math.round((target - payment.refunded) * 100) / 100, target,
        status: 'pending' as const, requestedAtIso: new Date().toISOString() };
      return { ...state, [USERS_TABLE_NAME]: { ...table, byId: { ...table.byId,
        [userId]: { ...payer, affiliatePayments: { ...payer.affiliatePayments, [paymentId]: { ...payment, refundRequest } } },
        [recipient.id]: { ...recipient, activities: { ...recipient.activities,
          paymentRefundsPending: (recipient.activities.paymentRefundsPending ?? 0)
            + Number(payment.refundRequest?.status !== 'pending') } }
      } } };
    });
  }

  approveChangedTermsRefund(userId: string, refundId: string): string | null {
    const users = this.memoryDb.read()[USERS_TABLE_NAME];
    for (const payerId of users.ids) {
      for (const [paymentId, payment] of Object.entries(users.byId[payerId].affiliatePayments ?? {})) {
        if (payment.refundRequest?.id !== refundId) continue;
        if (payment.recipientUserId !== userId) throw new Error('Only the recipient can approve this refund.');
        if (payment.refundRequest.status === 'pending') {
          this.recordPayment(payerId, paymentId, payment.currency, payment.gross, payment.refundRequest.target, payment.eventBooking);
        }
        return payerId;
      }
    }
    return null;
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
