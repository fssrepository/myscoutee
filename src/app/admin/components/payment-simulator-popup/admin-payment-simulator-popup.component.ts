import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { HttpPaymentSimulatorAdminService } from '../../../shared/core/http/services/payment-simulator-admin.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/deployment-configuration.service';
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
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly sourceUrl = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorKey = signal('');
  protected readonly frameVisible = computed(() => this.sourceUrl() !== null && !this.errorKey());
  protected readonly authorizationSurface = computed(
    () => this.admin.activePopup() === 'payment-authorizations'
  );
  protected readonly titleKey = computed(() => this.authorizationSurface()
    ? 'admin.payment.simulator.authorization'
    : 'admin.payment.simulator');
  protected readonly loadingKey = computed(() => this.authorizationSurface()
    ? 'admin.payment.simulator.authorization.loading'
    : 'admin.payment.simulator.loading');
  private activeSurface: 'payment-simulator' | 'payment-authorizations' | null = null;
  private requestGeneration = 0;
  private simulatorOrigin = '';

  constructor() {
    effect(() => {
      const activePopup = this.admin.activePopup();
      const surface = activePopup === 'payment-simulator' || activePopup === 'payment-authorizations'
        ? activePopup
        : null;
      if (surface === this.activeSurface) {
        return;
      }
      this.activeSurface = surface;
      this.requestGeneration += 1;
      this.sourceUrl.set(null);
      this.simulatorOrigin = '';
      this.loading.set(false);
      this.errorKey.set('');
      if (surface) {
        queueMicrotask(() => void this.loadConfiguration());
      }
    });
  }

  protected popupModel(): PopupModel {
    const authorizationSurface = this.authorizationSurface();
    return {
      title: authorizationSurface
        ? 'admin.payment.simulator.authorization'
        : 'admin.payment.simulator',
      subtitle: authorizationSurface
        ? 'admin.payment.simulator.authorization.subtitle'
        : 'admin.payment.simulator.subtitle',
      ariaLabel: authorizationSurface
        ? 'admin.payment.simulator.authorization'
        : 'admin.payment.simulator',
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

  @HostListener('window:message', ['$event'])
  protected onSimulatorMessage(event: MessageEvent): void {
    if (
      this.admin.activePopup() !== 'payment-simulator'
      || !this.simulatorOrigin
      || event.origin !== this.simulatorOrigin
    ) {
      return;
    }
    const payload = event.data as {
      source?: string;
      type?: string;
      provider?: string;
    } | null;
    const provider = `${payload?.provider ?? ''}`.trim().toLowerCase();
    if (
      payload?.source !== 'myscoutee-payment-simulator'
      || payload.type !== 'configuration'
      || !['none', 'stripe', 'barion'].includes(provider)
    ) {
      return;
    }
    this.deploymentConfiguration.applyPaymentProviderId(
      provider === 'none' ? null : provider
    );
  }

  private async loadConfiguration(): Promise<void> {
    const generation = ++this.requestGeneration;
    const authorizationSurface = this.authorizationSurface();
    this.loading.set(true);
    this.errorKey.set('');
    this.sourceUrl.set(null);
    try {
      const access = authorizationSurface
        ? await this.simulator.createAuthorizationAccess()
        : await this.simulator.createConfigurationAccess();
      if (generation !== this.requestGeneration || this.authorizationSurface() !== authorizationSurface) {
        return;
      }
      this.simulatorOrigin = new URL(access.url).origin;
      this.sourceUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(access.url));
    } catch (error) {
      if (generation !== this.requestGeneration || this.authorizationSurface() !== authorizationSurface) {
        return;
      }
      const message = error instanceof Error ? error.message.trim() : '';
      this.errorKey.set(message.startsWith('admin.payment.simulator.')
        ? message
        : authorizationSurface
          ? 'admin.payment.simulator.authorization.unavailable'
          : 'admin.payment.simulator.unavailable');
      this.loading.set(false);
    }
  }
}
