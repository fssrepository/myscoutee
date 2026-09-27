import { Injectable, inject, signal } from '@angular/core';

import type { ListQuery } from '../../contracts/list.interface';
import type {
  CashReceiptRequestDto,
  PaymentHistoryPageDto,
  PaymentHistoryMutationDto,
  PaymentMethodRegistrationDto,
  PaymentMethodRegistrationRequestDto,
  SavedPaymentMethodsPageDto
} from '../../contracts/payment-method.interface';
import { HttpPaymentMethodsService } from '../../http/services/payment-methods.service';
import { LocalPaymentMethodsService } from '../../local/source/services/payment-methods.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({ providedIn: 'root' })
export class PaymentMethodsService extends BaseRouteModeService {
  static readonly ROUTE = '/payment-methods';
  static readonly HISTORY_POLL_INTERVAL_MS = 15000;
  private readonly localService = inject(LocalPaymentMethodsService);
  private readonly httpService = inject(HttpPaymentMethodsService);

  readonly summaryCurrencyRevision = signal(0);
  async selectSummaryCurrency(userId: string, currency: string): Promise<void> {
    await this.service.selectSummaryCurrency(userId, currency);
    this.summaryCurrencyRevision.update(value => value + 1);
  }

  get localModeEnabled(): boolean {
    return this.isLocalRouteEnabled(PaymentMethodsService.ROUTE);
  }

  deleteCashReceipt(userId: string, paymentId: string): Promise<PaymentHistoryMutationDto> {
    return this.service.deleteCashReceipt(userId, paymentId);
  }

  recordCashReceipt(userId: string, request: CashReceiptRequestDto): Promise<PaymentHistoryMutationDto> {
    return this.service.recordCashReceipt(userId, request);
  }

  queryPage(userId: string, query: ListQuery, signal?: AbortSignal): Promise<SavedPaymentMethodsPageDto> {
    return this.service.queryPage(userId, query, signal);
  }

  beginRegistration(
    userId: string,
    request: PaymentMethodRegistrationRequestDto,
    signal?: AbortSignal
  ): Promise<PaymentMethodRegistrationDto> {
    return this.service.beginRegistration(userId, request, signal);
  }

  refreshRegistration(userId: string, registrationId: string, signal?: AbortSignal): Promise<PaymentMethodRegistrationDto> {
    return this.service.refreshRegistration(userId, registrationId, signal);
  }

  deletePaymentMethod(userId: string, paymentMethodId: string, signal?: AbortSignal): Promise<void> {
    return this.service.deletePaymentMethod(userId, paymentMethodId, signal);
  }

  queryHistory(
    userId: string,
    paymentMethodId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<PaymentHistoryPageDto> {
    return this.service.queryHistory(userId, paymentMethodId, query, signal);
  }

  async queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto> {
    const service = this.service;
    const size = Math.max(20, Math.trunc(query.pageSize || 20));
    const cursorOffset = /^history:(\d+)$/.exec(query.cursor ?? '');
    const offset = cursorOffset ? Number(cursorOffset[1]) : Math.max(0, query.page) * size;
    const firstPage = Math.floor(offset / 20);
    // SmartList polls its entire loaded window. Read bounded adapter pages
    // and retain an item offset, since a mutation can change that window by
    // one row without advancing by a whole page.
    const first = await service.queryAllHistory(userId, {
      ...query, page: firstPage, pageSize: 20, cursor: undefined
    }, signal);
    const items = [...first.items];
    const skip = offset % 20;
    for (let page = firstPage + 1; items.length < Math.min(skip + size, first.total - firstPage * 20); page++) {
      signal?.throwIfAborted();
      const next = await service.queryAllHistory(userId, { ...query, page, pageSize: 20, cursor: undefined }, signal);
      if (!next.items.length) break;
      items.push(...next.items);
    }
    const window = items.slice(skip, skip + size);
    return {
      ...first, items: window,
      nextCursor: offset + window.length < first.total ? `history:${offset + window.length}` : null
    };
  }

  requestRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    return this.service.requestRefund(userId, paymentId, signal);
  }

  approveRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto> {
    return this.service.approveRefund(userId, paymentId, signal);
  }

  private get service(): LocalPaymentMethodsService | HttpPaymentMethodsService {
    return this.resolveRouteService(PaymentMethodsService.ROUTE, this.localService, this.httpService);
  }
}
