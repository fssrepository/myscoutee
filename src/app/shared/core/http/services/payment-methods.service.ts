import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { RouteDelayService } from '../../base/services/route-delay.service';
import type { ListQuery } from '../../contracts/list.interface';
import type {
  PaymentHistoryPageDto,
  PaymentMethodDataService,
  PaymentMethodRegistrationDto,
  PaymentMethodRegistrationRequestDto,
  SavedPaymentMethodsPageDto
} from '../../contracts/payment-method.interface';

@Injectable({ providedIn: 'root' })
export class HttpPaymentMethodsService implements PaymentMethodDataService {
  private static readonly ROUTE = '/payment-methods';
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async queryPage(userId: string, query: ListQuery, signal?: AbortSignal): Promise<SavedPaymentMethodsPageDto> {
    const response = await this.withTimeout(this.http.get<Partial<SavedPaymentMethodsPageDto> | null>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}`,
      { params: this.pageParams(userId, query) }
    ), signal);
    const items = Array.isArray(response?.items) ? response.items : [];
    return {
      items,
      total: Math.max(0, Math.trunc(Number(response?.total) || items.length)),
      nextCursor: `${response?.nextCursor ?? ''}`.trim() || null,
      canAdd: response?.canAdd === true,
      pendingRegistration: response?.pendingRegistration?.id?.trim()
        ? this.requireRegistration(response.pendingRegistration)
        : null
    };
  }

  async beginRegistration(
    userId: string,
    request: PaymentMethodRegistrationRequestDto,
    signal?: AbortSignal
  ): Promise<PaymentMethodRegistrationDto> {
    return this.requireRegistration(await this.withTimeout(this.http.post<PaymentMethodRegistrationDto | null>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}/registrations`,
      request,
      { params: this.userParams(userId) }
    ), signal));
  }

  async refreshRegistration(userId: string, registrationId: string, signal?: AbortSignal): Promise<PaymentMethodRegistrationDto> {
    return this.requireRegistration(await this.withTimeout(this.http.get<PaymentMethodRegistrationDto | null>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}/registrations/${encodeURIComponent(registrationId.trim())}`,
      { params: this.userParams(userId) }
    ), signal));
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string, signal?: AbortSignal): Promise<void> {
    await this.withTimeout(this.http.delete<void>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}/${encodeURIComponent(paymentMethodId.trim())}`,
      { params: this.userParams(userId) }
    ), signal);
  }

  async queryHistory(
    userId: string,
    paymentMethodId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<PaymentHistoryPageDto> {
    const response = await this.withTimeout(this.http.get<Partial<PaymentHistoryPageDto> | null>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}/${encodeURIComponent(paymentMethodId.trim())}/history`,
      { params: this.pageParams(userId, query) }
    ), signal);
    const items = Array.isArray(response?.items) ? response.items : [];
    return {
      items,
      total: Math.max(0, Math.trunc(Number(response?.total) || items.length)),
      nextCursor: `${response?.nextCursor ?? ''}`.trim() || null,
      spendingTotals: this.normalizeSpendingTotals(response?.spendingTotals)
    };
  }

  async queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto> {
    const response = await this.withTimeout(this.http.get<Partial<PaymentHistoryPageDto> | null>(
      `${this.apiBaseUrl}${HttpPaymentMethodsService.ROUTE}/history`,
      { params: this.pageParams(userId, query) }
    ), signal);
    const items = Array.isArray(response?.items) ? response.items : [];
    return {
      items,
      total: Math.max(0, Math.trunc(Number(response?.total) || items.length)),
      nextCursor: `${response?.nextCursor ?? ''}`.trim() || null,
      spendingTotals: this.normalizeSpendingTotals(response?.spendingTotals)
    };
  }

  private normalizeSpendingTotals(value: Record<string, number> | null | undefined): Record<string, number> {
    return Object.fromEntries(Object.entries(value ?? {}).flatMap(([currency, amount]) => {
      const key = currency.trim().toUpperCase();
      const numeric = Number(amount);
      return key && Number.isFinite(numeric) && numeric >= 0 ? [[key, numeric]] : [];
    }));
  }

  private pageParams(userId: string, query: ListQuery): HttpParams {
    return this.userParams(userId)
      .set('page', `${Math.max(0, Math.trunc(Number(query.page) || 0))}`)
      .set('size', `${Math.max(1, Math.min(50, Math.trunc(Number(query.pageSize) || 6)))}`);
  }

  private userParams(userId: string): HttpParams {
    const normalized = userId.trim();
    return normalized ? new HttpParams().set('userId', normalized) : new HttpParams();
  }

  private requireRegistration(value: PaymentMethodRegistrationDto | null): PaymentMethodRegistrationDto {
    if (!value?.id?.trim()) {
      throw new Error('Payment provider returned an invalid registration response.');
    }
    return value;
  }

  private withTimeout<T>(request: Observable<T>, signal?: AbortSignal): Promise<T> {
    return this.routeDelay.withRequestTimeout(
      HttpPaymentMethodsService.ROUTE,
      this.requestWithAbort(request, signal),
      'Payment method request timed out.'
    );
  }

  private requestWithAbort<T>(request: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let subscription: Subscription | null = null;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => {
        if (settled) return;
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        const error = new Error('Request aborted.');
        error.name = 'AbortError';
        reject(error);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request.subscribe({
        next: value => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
        complete: cleanup
      });
    });
  }
}
