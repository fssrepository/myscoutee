import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../shared/core/base/operator-registry-candidate';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import {
  LinkInputComponent,
  type LinkInputConfig
} from '../../../shared/ui/components/core/form/inputs/link-input';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { I18nPipe } from '../../../shared/ui/pipes';

@Component({
  selector: 'app-operator-registry-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IndicatorComponent,
    I18nPipe,
    LinkInputComponent,
    MatIconModule,
    PopupComponent
  ],
  templateUrl: './operator-registry-popup.component.html',
  styleUrl: './operator-registry-popup.component.scss'
})
export class OperatorRegistryPopupComponent implements OnInit {
  protected readonly registry = inject(OperatorRegistryStore);
  protected readonly operatorMenu = inject(OperatorMenuStore);
  private readonly i18n = inject(I18nService);
  protected readonly status = this.registry.status;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly errorMessage = this.registry.error;
  protected readonly noticeMessage = this.registry.notice;
  protected readonly registryBaseUrl = this.registry.registryBaseUrl;
  protected readonly expectedRegistryScope = this.registry.expectedRegistryScope;
  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly loading = computed(() => this.busyAction() === 'load');
  protected readonly canRegister = this.registry.canRegister;
  protected readonly currentRegistryUrl = computed(
    () => this.status()?.selection?.baseUrl?.trim() ?? ''
  );
  protected readonly registered = computed(() =>
    this.status()?.enabled === true && this.status()?.lifecycle === 'REGISTERED'
  );
  protected readonly registryUrlConfig = computed<LinkInputConfig>(() => {
    const currentUrl = this.currentRegistryUrl();
    return {
      label: this.i18n.translate('operator.registration.registry.url'),
      placeholder: 'https://registry.example.com',
      required: true,
      availableUrls: this.registry.registryOptions().map(option => ({
        url: option.baseUrl,
        label: this.i18n.translate(option.label),
        description: option.description
          ? this.i18n.translate(option.description)
          : option.registryScope || option.baseUrl,
        disabled: option.selected === true || this.sameUrl(option.baseUrl, currentUrl)
      })),
      availableUrlsAriaLabel: this.i18n.translate('operator.registration.registry.options'),
      pasteAriaLabel: this.i18n.translate('operator.registration.url.paste'),
      openAriaLabel: this.i18n.translate('operator.registration.url.open'),
      deleteAriaLabel: this.i18n.translate('operator.registration.url.clear')
    };
  });

  ngOnInit(): void {
    void this.registry.loadStatus();
  }

  protected popupModel(): PopupModel {
    return {
      title: 'operator.action.node.registration',
      subtitle: 'operator.registration.subtitle',
      ariaLabel: 'operator.action.node.registration',
      closeAriaLabel: 'operator.popup.close',
      size: 'small',
      height: 'auto',
      mobilePresentation: 'compact',
      headerTone: 'accent',
      headerPalette: 'violet',
      bodyLayout: 'default',
      headerActions: [
        {
          id: 'refresh',
          icon: 'refresh',
          ariaLabel: 'operator.registration.refresh',
          palette: 'violet',
          disabled: this.busy()
        }
      ],
      onAction: event => this.onPopupAction(event),
      onClose: () => this.close()
    };
  }

  protected updateRegistryBaseUrl(value: string): void {
    this.registry.setRegistryBaseUrl(value);
    const selectedOption = this.registry.registryOptions()
      .find(option => this.sameUrl(option.baseUrl, value));
    if (selectedOption?.registryScope) {
      this.registry.setExpectedRegistryScope(selectedOption.registryScope);
    }
  }

  protected async registerNode(): Promise<void> {
    const requireHttps = this.status()?.mode === 'REAL';
    const baseUrlError = validateOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      requireHttps
    );
    const scopeError = validateOperatorRegistryScope(this.expectedRegistryScope());
    if (baseUrlError || scopeError) {
      this.registry.setError(baseUrlError || scopeError);
      return;
    }
    this.registry.setRegistryBaseUrl(normalizeOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      requireHttps
    ));
    this.registry.clearFeedback();
    const status = await this.registry.register();
    if (status) {
      this.registry.setNotice('operator.registration.completed');
    }
  }

  protected async disconnect(): Promise<void> {
    this.registry.clearFeedback();
    const status = await this.registry.disconnect();
    if (status) {
      this.registry.setNotice('operator.registration.disabled');
    }
  }

  protected close(): void {
    this.registry.clearFeedback();
    this.operatorMenu.closePopup();
  }

  protected lifecycleLabel(): string {
    switch (this.status()?.lifecycle) {
      case 'REGISTERED':
        return 'operator.registration.status.registered';
      case 'REGISTERING':
      case 'PENDING':
        return 'operator.registration.status.registering';
      case 'CONFIGURED':
      case 'INSPECTED':
        return 'operator.registration.status.configured';
      case 'ERROR':
        return 'operator.registration.status.error';
      case 'DISABLED':
        return 'operator.registration.status.disabled';
      case 'UNCONFIGURED':
      default:
        return 'operator.registration.status.not.registered';
    }
  }

  protected busyLabel(): string {
    switch (this.busyAction()) {
      case 'register':
        return 'operator.registration.registering';
      case 'disconnect':
        return 'operator.registration.disabling';
      default:
        return 'operator.registration.loading';
    }
  }

  private onPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'refresh') {
      void this.registry.loadStatus();
    }
  }

  private sameUrl(left: string, right: string): boolean {
    if (!left.trim() || !right.trim()) {
      return false;
    }
    try {
      return normalizeOperatorRegistryBaseUrl(left, false)
        === normalizeOperatorRegistryBaseUrl(right, false);
    } catch {
      return left.trim().replace(/\/+$/, '') === right.trim().replace(/\/+$/, '');
    }
  }
}
