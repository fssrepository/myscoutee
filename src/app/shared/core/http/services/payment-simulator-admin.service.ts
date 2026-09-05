import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { RouteDelayService } from '../../base/services/route-delay.service';

export interface PaymentSimulatorConfigurationAccessDto {
  url: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class HttpPaymentSimulatorAdminService {
  private static readonly ROUTE = '/admin/payment-simulator/configuration-access';
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);

  async createConfigurationAccess(): Promise<PaymentSimulatorConfigurationAccessDto> {
    const endpoint = `${environment.paymentSimulatorConfigUrl ?? ''}`.trim();
    if (!endpoint) {
      throw new Error('admin.payment.simulator.unavailable');
    }
    const response = await this.routeDelay.withRequestTimeout(
      HttpPaymentSimulatorAdminService.ROUTE,
      this.http.post<PaymentSimulatorConfigurationAccessDto | null>(endpoint, {}).toPromise(),
      'admin.payment.simulator.timeout'
    );
    const url = `${response?.url ?? ''}`.trim();
    const expiresAt = `${response?.expiresAt ?? ''}`.trim();
    if (!url || !expiresAt || !this.isAllowedUrl(url)) {
      throw new Error('admin.payment.simulator.unavailable');
    }
    return { url, expiresAt };
  }

  private isAllowedUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
