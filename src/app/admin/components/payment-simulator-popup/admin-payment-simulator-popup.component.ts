import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { HttpPaymentSimulatorAdminService } from '../../../shared/core/http/services/payment-simulator-admin.service';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { AdminMenuStore } from '../../../shared/ui/context/stores/admin-menu.store';
import { I18nPipe } from '../../../shared/ui/pipes';

@Component({
  selector: 'app-admin-payment-simulator-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, IndicatorComponent, I18nPipe, PopupComponent],
  templateUrl: './admin-payment-simulator-popup.component.html',
  styleUrl: './admin-payment-simulator-popup.component.scss'
})
export class AdminPaymentSimulatorPopupComponent {
  protected readonly admin = inject(AdminMenuStore);
  private readonly simulator = inject(HttpPaymentSimulatorAdminService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly sourceUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorKey = signal('');
  protected readonly frameVisible = computed(() => this.sourceUrl() !== null && !this.errorKey());
  private open = false;
  private requestGeneration = 0;

  constructor() {
    effect(() => {
      const isOpen = this.admin.activePopup() === 'payment-simulator';
      if (isOpen && !this.open) {
        this.open = true;
        queueMicrotask(() => void this.loadConfiguration());
        return;
      }
      if (!isOpen && this.open) {
        this.open = false;
        this.requestGeneration += 1;
        this.sourceUrl.set(null);
        this.loading.set(false);
        this.errorKey.set('');
      }
    });
  }

  protected popupModel(): PopupModel {
    return {
      title: 'admin.payment.simulator',
      subtitle: 'admin.payment.simulator.subtitle',
      ariaLabel: 'admin.payment.simulator',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'flush',
      onClose: () => this.close()
    };
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected retry(): void {
    void this.loadConfiguration();
  }

  protected frameLoaded(): void {
    this.loading.set(false);
  }

  private async loadConfiguration(): Promise<void> {
    const generation = ++this.requestGeneration;
    this.loading.set(true);
    this.errorKey.set('');
    this.sourceUrl.set(null);
    try {
      const access = await this.simulator.createConfigurationAccess();
      if (generation !== this.requestGeneration || this.admin.activePopup() !== 'payment-simulator') {
        return;
      }
      this.sourceUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(access.url));
    } catch (error) {
      if (generation !== this.requestGeneration || this.admin.activePopup() !== 'payment-simulator') {
        return;
      }
      const message = error instanceof Error ? error.message.trim() : '';
      this.errorKey.set(message.startsWith('admin.payment.simulator.')
        ? message
        : 'admin.payment.simulator.unavailable');
      this.loading.set(false);
    }
  }
}
