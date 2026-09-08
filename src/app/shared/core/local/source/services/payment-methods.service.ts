import { Injectable, inject } from '@angular/core';

import type { ListQuery } from '../../../contracts/list.interface';
import type {
  PaymentHistoryItemDto,
  PaymentHistoryMutationDto,
  PaymentHistoryPageDto,
  PaymentMethodDataService,
  PaymentMethodRegistrationDto,
  PaymentMethodRegistrationRequestDto,
  SavedPaymentMethodDto,
  SavedPaymentMethodsPageDto
} from '../../../contracts/payment-method.interface';
import { LocalPaymentCardArtworkRepository } from '../repositories/payment-card-artwork.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({ providedIn: 'root' })
export class LocalPaymentMethodsService extends LocalRouteDelayService implements PaymentMethodDataService {
  private static readonly ROUTE = '/payment-methods';
  private readonly artworkRepository = inject(LocalPaymentCardArtworkRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly deletedPaymentMethodIds = new Set<string>();
  private readonly refundRequestStatusByPaymentId = new Map<string, 'pending' | 'approved'>();

  async queryPage(userId: string, query: ListQuery, signal?: AbortSignal): Promise<SavedPaymentMethodsPageDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const all = await Promise.all(this.seedMethods(userId)
      .filter(method => !this.deletedPaymentMethodIds.has(method.id))
      .map(async method => ({
      ...method,
      artworkUrl: await this.artworkRepository.resolveUrl(method.artworkKey)
      })));
    const pageSize = Math.max(1, Math.min(6, Math.trunc(Number(query.pageSize) || 6)));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const from = Math.min(all.length, page * pageSize);
    const items = all.slice(from, from + pageSize);
    return {
      items,
      total: all.length,
      nextCursor: from + items.length < all.length ? `${page + 1}` : null,
      canAdd: false,
      pendingRegistration: null,
      currentProvider: null
    };
  }

  async beginRegistration(
    _userId: string,
    _request: PaymentMethodRegistrationRequestDto,
    signal?: AbortSignal
  ): Promise<PaymentMethodRegistrationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    throw new Error('Card registration is disabled in frontend-local mode.');
  }

  async refreshRegistration(_userId: string, _registrationId: string, signal?: AbortSignal): Promise<PaymentMethodRegistrationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    throw new Error('Card registration is disabled in frontend-local mode.');
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string, signal?: AbortSignal): Promise<void> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const ownerId = userId.trim();
    const methodId = paymentMethodId.trim();
    const owned = this.seedMethods(ownerId).some(method => method.id === methodId);
    if (!owned) {
      throw new Error('Payment card was not found.');
    }
    this.deletedPaymentMethodIds.add(methodId);
  }

  async queryHistory(
    userId: string,
    paymentMethodId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<PaymentHistoryPageDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const card = this.seedMethods(userId).find(item => item.id === paymentMethodId);
    const all = card ? this.seedHistory(card).map(item => this.withRefundState(item)) : [];
    const pageSize = Math.max(1, Math.min(20, Math.trunc(Number(query.pageSize) || 20)));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const from = Math.min(all.length, page * pageSize);
    const items = all.slice(from, from + pageSize);
    return {
      items,
      total: all.length,
      nextCursor: from + items.length < all.length ? `${page + 1}` : null,
      spendingTotals: this.paymentTotals(all, 'expense'),
      incomeTotals: {},
      pendingRefundCount: this.pendingRefundCount(userId)
    };
  }

  async queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const expenses = this.seedMethods(userId).flatMap(card => this.seedHistory(card)).map(item => this.withRefundState(item));
    const income = this.seedIncomeHistory(userId).map(item => this.withRefundState(item));
    const direction = `${(query.filters as { direction?: string } | undefined)?.direction ?? 'all'}`.trim();
    const all = (direction === 'expenses' ? expenses : direction === 'income' ? income : [...expenses, ...income])
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
    const pageSize = Math.max(1, Math.min(20, Math.trunc(Number(query.pageSize) || 20)));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const from = Math.min(all.length, page * pageSize);
    const items = all.slice(from, from + pageSize);
    return {
      items,
      total: all.length,
      nextCursor: from + items.length < all.length ? `${page + 1}` : null,
      spendingTotals: this.paymentTotals(expenses, 'expense'),
      incomeTotals: this.paymentTotals(income, 'income'),
      pendingRefundCount: this.pendingRefundCount(userId)
    };
  }

  async requestRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const item = this.seedMethods(userId)
      .flatMap(card => this.seedHistory(card))
      .find(candidate => candidate.id === paymentId && candidate.direction === 'expense');
    if (!item || !this.withRefundState(item).canRequestRefund) {
      throw new Error('This payment can no longer be refunded.');
    }
    this.refundRequestStatusByPaymentId.set(paymentId, 'pending');
    await this.patchPendingRefundCounter(item.recipientUserId ?? '', 1);
    return this.localMutation(userId, this.withRefundState(item));
  }

  async approveRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const item = this.seedIncomeHistory(userId).find(candidate => candidate.id === paymentId);
    if (!item || this.refundRequestStatusByPaymentId.get(paymentId) !== 'pending') {
      throw new Error('There is no pending refund request for this payment.');
    }
    this.refundRequestStatusByPaymentId.set(paymentId, 'approved');
    await this.patchPendingRefundCounter(userId, -1);
    return this.localMutation(userId, this.withRefundState({ ...item, status: 'refunded' }));
  }

  private seedMethods(userId: string): SavedPaymentMethodDto[] {
    const owner = userId.trim() || 'local-user';
    const now = new Date();
    const expiryYear = now.getFullYear() + 3;
    const createdAtIso = new Date(now.getTime() - 86_400_000 * 30).toISOString();
    return [
      this.method(owner, 'midnight', 'stripe', 'Visa', '4242', 12, expiryYear, 'ALEX MORGAN', createdAtIso),
      this.method(owner, 'emerald', 'barion', 'Mastercard', '4444', 8, expiryYear + 1, 'ALEX MORGAN', createdAtIso),
      {
        ...this.method(owner, 'coral', 'stripe', 'Visa', '0008', 8, now.getFullYear() - 1, 'ALEX MORGAN', createdAtIso),
        status: 'expired'
      }
    ];
  }

  private method(
    owner: string,
    artworkKey: string,
    provider: 'stripe' | 'barion',
    brand: string,
    last4: string,
    expiryMonth: number,
    expiryYear: number,
    cardholderName: string,
    createdAtIso: string
  ): SavedPaymentMethodDto {
    return {
      id: `local-pm-${owner}-${artworkKey}`,
      provider,
      brand,
      last4,
      expiryMonth,
      expiryYear,
      cardholderName,
      artworkKey,
      artworkUrl: '',
      status: 'active',
      createdAtIso,
      updatedAtIso: createdAtIso
    };
  }

  private seedHistory(card: SavedPaymentMethodDto): PaymentHistoryItemDto[] {
    const now = Date.now();
    const ownerPrefix = 'local-pm-';
    const artworkSuffix = `-${card.artworkKey}`;
    const owner = card.id.startsWith(ownerPrefix) && card.id.endsWith(artworkSuffix)
      ? card.id.slice(ownerPrefix.length, -artworkSuffix.length)
      : 'local-user';
    return [0, 1, 2].map((offset, index) => ({
      id: `${card.id}-payment-${index + 1}`,
      sourceId: index === 1 ? `${owner}:asset-transport-1` : 'e1',
      direction: 'expense' as const,
      paymentMethodId: card.id,
      provider: card.provider,
      status: index === 2 ? 'released' : 'captured',
      amount: [4900, 12500, 3200][index],
      currency: 'HUF',
      bookingStatus: index === 2 ? 'cancelled' : 'joined',
      auditKind: 'payment',
      fulfillmentKind: index === 1 ? 'client' : 'event_join',
      checkoutSessionId: `${card.id}-checkout-${index + 1}`,
      recipientUserId: index === 1 ? 'local-asset-owner' : 'local-event-organizer',
      serviceContext: index === 1 ? 'asset' : 'event',
      contextEventId: 'e1',
      contextSubEventId: index === 1 ? 'se1' : null,
      contextAssetId: index === 1 ? `${owner}:asset-transport-1` : null,
      createdAtIso: new Date(now - (offset + 1) * 86_400_000 * 7).toISOString()
    }));
  }

  private seedIncomeHistory(userId: string): PaymentHistoryItemDto[] {
    const owner = userId.trim() || 'local-user';
    const now = Date.now();
    return [0, 1].map((offset, index) => ({
      id: `local-income-${owner}-${index + 1}`,
      sourceId: index === 0 ? 'e1' : `${owner}:asset-transport-1`,
      direction: 'income' as const,
      paymentMethodId: null,
      provider: index === 0 ? 'stripe' : 'cash',
      status: 'captured',
      amount: [8400, 5600][index],
      currency: 'HUF',
      bookingStatus: 'joined',
      auditKind: 'payment',
      fulfillmentKind: index === 0 ? 'event_join' : 'client',
      checkoutSessionId: `local-income-${owner}-checkout-${index + 1}`,
      recipientUserId: owner,
      serviceContext: index === 1 ? 'asset' : 'event',
      contextEventId: 'e1',
      contextSubEventId: index === 1 ? 'se1' : null,
      contextAssetId: index === 1 ? `${owner}:asset-transport-1` : null,
      createdAtIso: new Date(now - (offset + 1) * 86_400_000 * 7).toISOString()
    }));
  }

  private paymentTotals(
    items: readonly PaymentHistoryItemDto[],
    direction: PaymentHistoryItemDto['direction']
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((totals, item) => {
      if (item.direction !== direction || (item.status !== 'captured' && item.status !== 'approved')) return totals;
      const currency = item.currency.trim().toUpperCase() || 'USD';
      totals[currency] = Math.round(((totals[currency] ?? 0) + (Number(item.amount) || 0)) * 100) / 100;
      return totals;
    }, {});
  }

  private withRefundState(item: PaymentHistoryItemDto): PaymentHistoryItemDto {
    const requestStatus = this.refundRequestStatusByPaymentId.get(item.id) ?? 'none';
    const refundableStatus = item.status === 'authorized' || item.status === 'captured'
      || item.status === 'approved' || item.status === 'partially_refunded';
    return {
      ...item,
      refundRequestStatus: requestStatus,
      canRequestRefund: item.direction === 'expense' && requestStatus === 'none' && refundableStatus,
      canApproveRefund: item.direction === 'income' && requestStatus === 'pending'
    };
  }

  private localMutation(userId: string, item: PaymentHistoryItemDto): PaymentHistoryMutationDto {
    const expenses = this.seedMethods(userId).flatMap(card => this.seedHistory(card)).map(candidate =>
      candidate.id === item.id ? item : this.withRefundState(candidate)
    );
    const income = this.seedIncomeHistory(userId).map(candidate =>
      candidate.id === item.id ? item : this.withRefundState(candidate)
    );
    return {
      item,
      spendingTotals: this.paymentTotals(expenses, 'expense'),
      incomeTotals: this.paymentTotals(income, 'income'),
      pendingRefundCount: this.pendingRefundCount(userId)
    };
  }

  private pendingRefundCount(userId: string): number {
    return Math.max(0, Math.trunc(Number(
      this.usersRepository.queryUserById(userId.trim())?.activities?.paymentRefundsPending
    ) || 0));
  }

  private async patchPendingRefundCounter(userId: string, delta: number): Promise<void> {
    const normalizedUserId = userId.trim();
    const current = this.usersRepository.queryUserById(normalizedUserId);
    if (!current) return;
    this.usersRepository.upsertUser({
      ...current,
      activities: {
        ...current.activities,
        paymentRefundsPending: Math.max(
          0,
          Math.trunc(Number(current.activities.paymentRefundsPending) || 0) + Math.trunc(delta)
        )
      }
    });
    await this.usersRepository.flushToIndexedDb();
  }

}
