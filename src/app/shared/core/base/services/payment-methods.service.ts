import { Injectable, inject } from '@angular/core';

import type { ListQuery } from '../../contracts/list.interface';
import type {
  PaymentHistoryPageDto,
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
  private readonly localService = inject(LocalPaymentMethodsService);
  private readonly httpService = inject(HttpPaymentMethodsService);

  get localModeEnabled(): boolean {
    return this.isLocalRouteEnabled(PaymentMethodsService.ROUTE);
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

  queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto> {
    return this.service.queryAllHistory(userId, query, signal);
  }

  private get service(): LocalPaymentMethodsService | HttpPaymentMethodsService {
    return this.resolveRouteService(PaymentMethodsService.ROUTE, this.localService, this.httpService);
  }
}
