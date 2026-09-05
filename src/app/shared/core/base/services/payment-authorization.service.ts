import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  EventCheckoutPaymentAudit,
  EventCheckoutSession
} from '../../contracts/activity.interface';
import { EventsService } from './events.service';
import { I18nService } from './i18n.service';

export interface PaymentAuthorizationContinuation {
  id: string;
  status: string;
  paymentUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentAuthorizationService {
  private static readonly POLL_INTERVAL_MS = 1500;
  private static readonly POLL_TIMEOUT_MS = 3 * 60 * 1000;

  private readonly events = inject(EventsService);
  private readonly i18n = inject(I18nService);

  openProviderWindow(): Window | null {
    if (!environment.paymentIntegrationEnabled || typeof window === 'undefined') {
      return null;
    }
    const popup = window.open(
      'about:blank',
      'myscoutee-payment-provider',
      'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes'
    );
    if (popup) {
      popup.opener = null;
    }
    return popup;
  }

  async completeCustomerAction(
    continuation: PaymentAuthorizationContinuation | EventCheckoutSession,
    userId: string,
    sourceId: string,
    providerWindow: Window | null
  ): Promise<EventCheckoutPaymentAudit | null> {
    const status = this.normalizedStatus(continuation?.status);
    if (this.isSuccessfulStatus(status)) {
      this.closeProviderWindow(providerWindow);
      return null;
    }
    const paymentUrl = this.normalizedPaymentUrl(continuation?.paymentUrl);
    if (!continuation?.id?.trim() || !paymentUrl) {
      this.closeProviderWindow(providerWindow);
      throw new Error(this.i18n.translate('payment.authorization.error.start'));
    }
    if (!providerWindow || providerWindow.closed) {
      throw new Error(this.i18n.translate('payment.authorization.error.popup'));
    }

    try {
      providerWindow.location.replace(paymentUrl);
      providerWindow.focus();
      return await this.waitForAuthorization(
        userId.trim(),
        sourceId.trim(),
        continuation.id.trim(),
        providerWindow
      );
    } finally {
      this.closeProviderWindow(providerWindow);
    }
  }

  closeProviderWindow(providerWindow: Window | null): void {
    if (!providerWindow || providerWindow.closed) {
      return;
    }
    providerWindow.close();
  }

  private async waitForAuthorization(
    userId: string,
    sourceId: string,
    paymentSessionId: string,
    providerWindow: Window
  ): Promise<EventCheckoutPaymentAudit> {
    const deadline = Date.now() + PaymentAuthorizationService.POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const audit = await this.events.loadCheckoutPaymentAudit(userId, sourceId, paymentSessionId);
      const status = this.normalizedStatus(audit?.status);
      if (audit && this.isSuccessfulStatus(status)) {
        return audit;
      }
      if (audit && this.isTerminalFailureStatus(status)) {
        throw new Error(this.i18n.translateParams('payment.authorization.error.failed', { status }));
      }
      if (providerWindow.closed) {
        throw new Error(this.i18n.translate('payment.authorization.error.cancelled'));
      }
      await this.delay(PaymentAuthorizationService.POLL_INTERVAL_MS);
    }
    throw new Error(this.i18n.translate('payment.authorization.error.timeout'));
  }

  private isSuccessfulStatus(status: string): boolean {
    return status === 'approved' || status === 'authorized' || status === 'captured';
  }

  private isTerminalFailureStatus(status: string): boolean {
    return status === 'cancelled'
      || status === 'declined'
      || status === 'expired'
      || status === 'failed'
      || status === 'released';
  }

  private normalizedStatus(value: string | null | undefined): string {
    return `${value ?? ''}`.trim().toLowerCase();
  }

  private normalizedPaymentUrl(value: string | null | undefined): string | null {
    const candidate = `${value ?? ''}`.trim();
    if (!candidate) {
      return null;
    }
    try {
      const url = new URL(candidate, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
