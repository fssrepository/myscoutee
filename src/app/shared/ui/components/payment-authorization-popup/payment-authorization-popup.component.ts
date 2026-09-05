import { Component, ElementRef, HostListener, ViewChild, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { PaymentAuthorizationService } from '../../../core/base/services/payment-authorization.service';
import { PopupComponent, type PopupModel } from '../core/popup';
import { I18nPipe } from '../../pipes';

@Component({
  selector: 'app-payment-authorization-popup',
  standalone: true,
  imports: [I18nPipe, PopupComponent],
  templateUrl: './payment-authorization-popup.component.html',
  styleUrl: './payment-authorization-popup.component.scss'
})
export class PaymentAuthorizationPopupComponent {
  @ViewChild('providerFrame')
  private providerFrame?: ElementRef<HTMLIFrameElement>;

  protected readonly authorization = inject(PaymentAuthorizationService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly sourceUrl = computed(() => {
    const url = this.authorization.waitingSurface()?.url;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected popupModel(): PopupModel {
    return {
      title: 'payment.authorization.waiting.title',
      subtitle: 'payment.authorization.waiting.subtitle',
      ariaLabel: 'payment.authorization.waiting.title',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'flush',
      closeOnBackdrop: false,
      onClose: () => this.authorization.closeWaitingSurface()
    };
  }

  @HostListener('window:message', ['$event'])
  protected onProviderMessage(event: MessageEvent): void {
    const waiting = this.authorization.waitingSurface();
    if (!waiting || event.source !== this.providerFrame?.nativeElement.contentWindow) {
      return;
    }
    let expectedOrigin = '';
    try {
      expectedOrigin = new URL(waiting.url, window.location.href).origin;
    } catch {
      return;
    }
    const message = event.data as {
      source?: string;
      type?: string;
      id?: string;
      status?: string;
    } | null;
    if (event.origin !== expectedOrigin
        || message?.source !== 'myscoutee-payment-simulator'
        || message.type !== 'payment-authorization') {
      return;
    }
    this.authorization.receiveProviderStatus(
      `${message.id ?? ''}`,
      `${message.status ?? ''}`
    );
  }
}
