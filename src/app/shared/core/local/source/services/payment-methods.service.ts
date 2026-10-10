import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalIntegrationRepository } from '../repositories/integration.repository';
import { Injectable, inject } from '@angular/core';

import type { ListQuery } from '@fssrepository/myscoutee-components';
import type {
  PaymentHistoryItemDto,
  PaymentHistoryMutationDto,
  CashReceiptRequestDto,
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
import { LocalPaymentSummaryMapper } from '../mappers/payment-summary.mapper';
import { SEED_PAYMENT_EXCHANGE_RATES } from '../../seed/payment-exchange-rates';

@Injectable({ providedIn: 'root' })
export class LocalPaymentMethodsService extends LocalRouteDelayService implements PaymentMethodDataService {
  private static readonly ROUTE = '/payment-methods';
  private readonly notificationsRepository = inject(LocalNotificationsRepository);
  private readonly artworkRepository = inject(LocalPaymentCardArtworkRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly affiliateRepository = inject(LocalIntegrationRepository);

  async selectSummaryCurrency(userId: string, currency: string): Promise<void> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE);
    if (!Object.hasOwn(SEED_PAYMENT_EXCHANGE_RATES, currency)) throw new Error('payment.currency.save.error');
    globalThis.localStorage?.setItem(`myscoutee.summary-currency.${userId}`, currency);
  }

  private summary(userId: string, items: PaymentHistoryItemDto[]): import('../../../contracts/payment-method.interface').PaymentEuroSummaryDto {
    return LocalPaymentSummaryMapper.build(userId, items
      .filter(item => item.status === 'captured' || item.status === 'approved' || item.status === 'refunded')
      .map(item => ({ currency: item.currency,
        outgoing: item.direction === 'expense' ? item.amount : 0,
        incoming: item.direction === 'income' ? item.amount : 0 })));
  }

  async deleteCashReceipt(userId: string, paymentId: string): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE);
    const item = this.affiliateRepository.deleteCashReceipt(userId, paymentId);
    await this.affiliateRepository.flushToIndexedDb();
    return { ...this.localMutation(userId, item), items: [item] };
  }

  async recordCashReceipt(userId: string, request: CashReceiptRequestDto): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE);
    const item = this.affiliateRepository.recordCashReceipt(userId, request);
    const kind=request.method==='bank-transfer'?'payment-transfer-received':'payment-cash-received';
    const groupId=this.usersRepository.queryUserById(userId)?.workspaceGroupId;
    this.notificationsRepository.append([{
      id:`${kind}:${item.id}`,recipientUserId:request.payerUserId,kind,category:'event',title:'Receipt recorded',message:'A member recorded receiving your payment.',
      createdAtIso:item.createdAtIso,readAtIso:null,senderUserId:userId,sourceType:'payment',sourceId:item.id,actionPath:'/game?payments=1',
      payload:{paymentId:item.id,...(groupId?{workspaceGroupId:groupId}:{}),notification_title_key:`notification.kind.${kind}.title`,notification_message_key:`notification.kind.${kind}.message`}
    }]);
    await this.affiliateRepository.flushToIndexedDb();
    return this.localMutation(userId, item);
  }

  async queryPage(userId: string, query: ListQuery, signal?: AbortSignal): Promise<SavedPaymentMethodsPageDto> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal),
      (async (): Promise<SavedPaymentMethodsPageDto> => {
        const all = await Promise.all(this.seedMethods(userId)
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
      })()
    ]);
    signal?.throwIfAborted();
    return response;
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
    const owner=this.usersRepository.queryUserById(ownerId)!;
    this.usersRepository.upsertUser({...owner,savedPaymentMethods:this.seedMethods(ownerId).filter(m=>m.id!==methodId)});
    await this.usersRepository.flushToIndexedDb();
  }

  async queryHistory(
    userId: string,
    paymentMethodId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<PaymentHistoryPageDto> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal),
      (async (): Promise<PaymentHistoryPageDto> => {
        const card = this.seedMethods(userId).find(item => item.id === paymentMethodId);
        const recorded = this.affiliateRepository.paymentHistory(userId);
        const all = card ? recorded.filter(item=>item.paymentMethodId===paymentMethodId).sort((a,b)=>b.createdAtIso.localeCompare(a.createdAtIso)) : [];
        const pageSize = Math.max(1, Math.min(20, Math.trunc(Number(query.pageSize) || 20)));
        const page = Math.max(0, Math.trunc(Number(query.page) || 0));
        const from = Math.min(all.length, page * pageSize);
        const items = all.slice(from, from + pageSize);
        return {
          items,
          total: all.length,
          nextCursor: from + items.length < all.length ? `${page + 1}` : null,
          euroSummary: this.summary(userId, recorded),
          spendingTotals: this.paymentTotals(recorded, 'expense'),
          incomeTotals: this.paymentTotals(recorded, 'income'),
          pendingRefundCount: this.pendingRefundCount(userId)
        };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }

  async queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal),
      (async (): Promise<PaymentHistoryPageDto> => {
        const recorded = this.affiliateRepository.paymentHistory(userId);
        const expenses=recorded.filter(item=>item.direction==='expense');
        const income=recorded.filter(item=>item.direction==='income');
        const direction = `${(query.filters as { direction?: string } | undefined)?.direction ?? 'all'}`.trim();
        const counterparty=(query.filters as {counterpartyUserId?:string}|undefined)?.counterpartyUserId?.trim();
        const all = (direction === 'expenses' ? expenses : direction === 'income' ? income : [...expenses, ...income])
          .filter(item=>!counterparty||item.counterpartyUserId===counterparty)
          .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
        const pageSize = Math.max(1, Math.min(20, Math.trunc(Number(query.pageSize) || 20)));
        const page = Math.max(0, Math.trunc(Number(query.page) || 0));
        const from = Math.min(all.length, page * pageSize);
        const items = all.slice(from, from + pageSize);
        return {
          items,
          total: all.length,
          nextCursor: from + items.length < all.length ? `${page + 1}` : null,
          euroSummary: this.summary(userId, [...expenses, ...income]),
          spendingTotals: this.paymentTotals(expenses, 'expense'),
          incomeTotals: this.paymentTotals(income, 'income'),
          pendingRefundCount: this.pendingRefundCount(userId)
        };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }

  async requestRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    if (this.affiliateRepository.requestPolicyRefund(userId, paymentId)) {
      await this.affiliateRepository.flushToIndexedDb();
      const recorded = this.affiliateRepository.paymentHistory(userId).find(item => item.id === paymentId);
      if (!recorded) throw new Error('Refund history was not recorded.');
      const pending=this.affiliateRepository.paymentHistory(userId).find(row=>row.checkoutSessionId===recorded.checkoutSessionId&&row.refundRequestStatus==='pending');
      if(pending&&recorded.recipientUserId&&recorded.recipientUserId!==userId){
        const group=this.usersRepository.queryUserById(recorded.recipientUserId)?.workspaceGroupId;
        this.notificationsRepository.append([{id:`payment-refund-requested:${pending.id}`,recipientUserId:recorded.recipientUserId,kind:'payment-refund-requested',category:'event',title:'Refund requested',message:'A member requested a refund.',createdAtIso:pending.createdAtIso,readAtIso:null,senderUserId:userId,sourceType:'payment',sourceId:pending.id,actionPath:'/game?payments=1',payload:{paymentId:pending.id,...(group?{workspaceGroupId:group}:{}),notification_title_key:'notification.kind.payment-refund-requested.title',notification_message_key:'notification.kind.payment-refund-requested.message'}}]);
        await this.affiliateRepository.flushToIndexedDb();
      }
      return this.localMutation(userId, recorded);
    }
    throw new Error('This payment can no longer be refunded.');
  }

  async approveRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    await this.waitForRouteDelay(LocalPaymentMethodsService.ROUTE, signal);
    const wasPending = this.affiliateRepository.paymentHistory(userId).some(item => item.id === paymentId && item.refundRequestStatus === 'pending');
    const payerId = this.affiliateRepository.approveChangedTermsRefund(userId, paymentId);
    if (payerId) {
      if (wasPending&&payerId!==userId) this.notificationsRepository.append([{
        id: `payment-refund-approved:${paymentId}`, recipientUserId: payerId, kind: 'payment-refund-approved',
        category: 'event' as const, title: 'Refund approved', message: 'Your refund request was approved.',
        createdAtIso: new Date().toISOString(), readAtIso: null, senderUserId: userId,
        sourceType: 'payment', sourceId: paymentId, actionPath: '/game?payments=1',
        payload: { paymentId, ...(this.usersRepository.queryUserById(payerId)?.workspaceGroupId?{workspaceGroupId:this.usersRepository.queryUserById(payerId)!.workspaceGroupId}:{}), notification_title_key: 'notification.kind.payment-refund-approved.title',
          notification_message_key: 'notification.kind.payment-refund-approved.message' }
      }]);
      await this.affiliateRepository.flushToIndexedDb();
      const recorded = this.affiliateRepository.paymentHistory(userId).find(item => item.id === paymentId);
      if (!recorded) throw new Error('Refund history was not recorded.');
      return this.localMutation(userId, recorded);
    }
    throw new Error('There is no pending refund request for this payment.');
  }

  private seedMethods(userId:string):SavedPaymentMethodDto[]{return this.usersRepository.queryUserById(userId)?.savedPaymentMethods??[];}

  private paymentTotals(
    items: readonly PaymentHistoryItemDto[],
    direction: PaymentHistoryItemDto['direction']
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((totals, item) => {
      if (item.direction !== direction || (item.status !== 'captured' && item.status !== 'approved' && item.status !== 'refunded')) return totals;
      const currency = item.currency.trim().toUpperCase() || 'USD';
      totals[currency] = Math.round(((totals[currency] ?? 0) + (Number(item.amount) || 0)) * 100) / 100;
      return totals;
    }, {});
  }

  private localMutation(userId: string, item: PaymentHistoryItemDto): PaymentHistoryMutationDto {
    const recorded=this.affiliateRepository.paymentHistory(userId);
    const expenses=recorded.filter(row=>row.direction==='expense'),income=recorded.filter(row=>row.direction==='income');
    return {
      item,
      items: item.checkoutSessionId ? recorded.filter(row => row.checkoutSessionId === item.checkoutSessionId) : [item],
      euroSummary: this.summary(userId, [...expenses, ...income]),
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

}
