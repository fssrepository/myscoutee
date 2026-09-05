import { Component, computed, inject } from '@angular/core';
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
}
