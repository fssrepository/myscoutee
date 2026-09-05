import { Injectable, inject, signal } from '@angular/core';
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

export interface PaymentAuthorizationWaitingSurface {
  id: string;
  url: string;
}

interface PaymentAuthorizationAttempt {
  id: string;
  cancelled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentAuthorizationService {
  private static readonly POLL_INTERVAL_MS = 1500;
  // The provider owns the three-minute authorization deadline. This small
  // grace period lets its terminal callback and result animation arrive
  // before the MyScoutee safety poll gives up.
  private static readonly POLL_TIMEOUT_MS = (3 * 60 * 1000) + 5000;

  private readonly events = inject(EventsService);
  private readonly i18n = inject(I18nService);
  private readonly waitingSurfaceRef = signal<PaymentAuthorizationWaitingSurface | null>(null);
  private activeAttempt: PaymentAuthorizationAttempt | null = null;

  readonly waitingSurface = this.waitingSurfaceRef.asReadonly();

  openProviderWindow(): Window | null {
    if (
      !environment.paymentIntegrationEnabled
      || environment.paymentSimulatorConfigUrl
      || typeof window === 'undefined'
    ) {
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
    providerWindow: Window | null = null
  ): Promise<EventCheckoutPaymentAudit | null> {
    const status = this.normalizedStatus(continuation?.status);
    if (this.isSuccessfulStatus(status)) {
      return null;
    }
    const paymentUrl = this.normalizedPaymentUrl(continuation?.paymentUrl);
    if (!continuation?.id?.trim() || !paymentUrl) {
      this.closeProviderWindow(providerWindow);
      throw new Error(this.i18n.translate('payment.authorization.error.start'));
    }
    const simulatorSurface = Boolean(environment.paymentSimulatorConfigUrl);
    if (!simulatorSurface && (!providerWindow || providerWindow.closed)) {
      throw new Error(this.i18n.translate('payment.authorization.error.popup'));
    }
    const attempt: PaymentAuthorizationAttempt = {
      id: continuation.id.trim(),
      cancelled: false
    };
    if (this.activeAttempt) {
      this.activeAttempt.cancelled = true;
    }
    this.activeAttempt = attempt;
    if (simulatorSurface) {
      this.waitingSurfaceRef.set({ id: attempt.id, url: paymentUrl });
    } else {
      providerWindow!.location.replace(paymentUrl);
      providerWindow!.focus();
    }
    try {
      return await this.waitForAuthorization(
        userId.trim(),
        sourceId.trim(),
        attempt
      );
    } finally {
      if (this.activeAttempt === attempt) {
        this.activeAttempt = null;
        this.waitingSurfaceRef.set(null);
      }
      this.closeProviderWindow(providerWindow);
    }
  }

  closeProviderWindow(providerWindow: Window | null): void {
    if (providerWindow && !providerWindow.closed) {
      providerWindow.close();
    }
  }

  closeWaitingSurface(): void {
    if (this.activeAttempt) {
      this.activeAttempt.cancelled = true;
    }
    this.waitingSurfaceRef.set(null);
  }

  receiveProviderStatus(id: string, status: string): void {
    const waiting = this.waitingSurfaceRef();
    if (!waiting || waiting.id !== id.trim()) {
      return;
    }
    const normalizedStatus = this.normalizedStatus(status);
    if (this.isSuccessfulStatus(normalizedStatus)
        || this.isTerminalFailureStatus(normalizedStatus)) {
      this.waitingSurfaceRef.set(null);
    }
  }

  private async waitForAuthorization(
    userId: string,
    sourceId: string,
    attempt: PaymentAuthorizationAttempt
  ): Promise<EventCheckoutPaymentAudit> {
    const deadline = Date.now() + PaymentAuthorizationService.POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (attempt.cancelled) {
        throw new Error(this.i18n.translate('payment.authorization.error.cancelled'));
      }
      const audit = await this.events.loadCheckoutPaymentAudit(userId, sourceId, attempt.id);
      const status = this.normalizedStatus(audit?.status);
      if (audit && this.isSuccessfulStatus(status)) {
        await this.waitForSimulatorResult(attempt);
        return audit;
      }
      if (audit && this.isTerminalFailureStatus(status)) {
        await this.waitForSimulatorResult(attempt);
        throw new Error(this.i18n.translateParams('payment.authorization.error.failed', { status }));
      }
      await this.delay(PaymentAuthorizationService.POLL_INTERVAL_MS);
    }
    throw new Error(this.i18n.translate('payment.authorization.error.timeout'));
  }

  private async waitForSimulatorResult(attempt: PaymentAuthorizationAttempt): Promise<void> {
    if (this.waitingSurfaceRef()?.id !== attempt.id) {
      return;
    }
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && this.waitingSurfaceRef()?.id === attempt.id) {
      if (attempt.cancelled) {
        throw new Error(this.i18n.translate('payment.authorization.error.cancelled'));
      }
      await this.delay(50);
    }
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
      const baseUrl = typeof window === 'undefined' ? 'http://localhost/' : window.location.href;
      const url = new URL(candidate, baseUrl);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
