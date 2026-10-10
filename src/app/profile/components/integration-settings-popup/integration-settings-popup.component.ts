import { McpConnectionsComponent } from './mcp-connections.component';
import { IntegrationAccessButtonComponent } from './integration-access-button.component';
import { IntegrationSettingsStore } from '../../../shared/ui/context/stores/profile/integration-settings.store';
import {
  CopyLinkComponent,
  ExplanationGuideService,
  PopupComponent,
  type PopupActionEvent,
  type PopupModel,
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  I18nPipe,
  DialogStore
} from '@myscoutee/components';
import { SummaryCurrencyPopupComponent } from '../../../shared/ui/components/summary-currency-popup/summary-currency-popup.component';
import { PaymentMethodsService } from '../../../shared/core/base/services/payment-methods.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, computed, effect, untracked, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { IntegrationService } from '../../../shared/core/base/services/integration.service';
import { I18nService } from '../../../shared/core/base/services/i18n.service';

import type {
  IntegrationTokenDto
} from '../../../shared/core/contracts/integration.interface';

type IntegrationActionContext =
  | { action: 'copy'; value: string }
  | { action: 'revoke'; token: IntegrationTokenDto };

@Component({
  selector: 'app-integration-settings-popup',
  standalone: true,
  providers: [IntegrationSettingsStore],
  imports: [
    IntegrationAccessButtonComponent,
    McpConnectionsComponent,
    CopyLinkComponent,
    SummaryCurrencyPopupComponent,
    CommonModule,
    MatIconModule,
    PopupComponent,
    AppMenuComponent,
    I18nPipe
  ],
  templateUrl: './integration-settings-popup.component.html',
  styleUrl: './integration-settings-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntegrationSettingsPopupComponent implements OnDestroy {
  protected readonly store = inject(IntegrationSettingsStore);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private unregisterExplanationContext: (() => void) | null = null;
  @Input() adminMode = false;
  @Input() roleReadOnly = false;
  private unregisterHelpContext: (() => void) | null = null;
  private readonly integrationService = inject(IntegrationService);
  private readonly i18nService = inject(I18nService);
  private readonly dialogStore = inject(DialogStore);

  protected readonly open = signal(false);
  protected readonly helpOpen = signal(false);
  private readonly paymentMethods = inject(PaymentMethodsService);
  protected readonly currencyPickerOpen = signal(false);
  private readonly currencyRefresh = effect(() => {
    const revision = this.paymentMethods.summaryCurrencyRevision();
    if (revision > 0) untracked(() => { if (this.open() && !this.adminMode) void this.store.reload(); });
  });
  protected readonly revenueOpen = signal(false);
  protected readonly revenue = computed(() => this.settings()?.affiliate?.revenue ?? {
    currencies: {}, purchases: 0, eventBookings: 0, euroSummary: null
  });
  protected revenuePopupModel(): PopupModel {
    const summary = this.revenue().euroSummary;
    return {
      title: 'affiliate.revenue.title', size: 'small', height: 'auto',
      mobilePresentation: 'fullscreen', backdropTone: 'dim', closeAriaLabel: 'close',
      headerControls: summary ? [{ kind: 'menu', id: 'currency', model: { density: 'compact' },
        trigger: { id: 'currency', label: summary.currency, trailingIcon: 'chevron_right', ariaLabel: 'payment.currency.title',
          palette: 'blue', layout: 'pill', action: 'custom' } }] : [],
      onMenuSelect: () => this.currencyPickerOpen.set(true),
      onClose: () => this.revenueOpen.set(false)
    };
  }

  protected readonly loading = this.store.loading;
  protected readonly mutating = this.store.busy;
  protected readonly settings = this.store.settings;
  protected readonly revealedToken = signal('');
  protected readonly revealedTokenId = signal('');
  private readonly clearRevealedTokenOnContextChange = effect(() => {
    this.store.contextVersion();
    this.revealedToken.set('');
    this.revealedTokenId.set('');
  });
  protected readonly errorMessage = this.store.error;
  protected readonly copiedValue = signal('');
  protected readonly baseUrl = computed(() => this.integrationService.absoluteBaseUrl(this.settings()?.baseUrl ?? ''));
  protected readonly affiliateUrl = computed(() =>
    this.integrationService.absoluteBaseUrl(this.settings()?.affiliate?.url ?? ''));
  protected readonly canGenerate = computed(() => {
    const settings = this.settings();
    return !!settings && settings.tokens.length < settings.maxActiveTokens && !this.mutating();
  });
  protected readonly actionMenuModel: AppMenuModel = { actionSizing: 'content' };
  protected get integrationDocumentationUrl() { return this.adminMode
    ? 'https://github.com/fssrepository/myscoutee-client-admin#documentation'
    : 'https://github.com/fssrepository/myscoutee-backend#documentation-pdfs'; }
  protected readonly clientDownloadActions: readonly AppMenuItem[] = [{
    id: 'admin-client-download',
    icon: 'install_desktop',
    label: 'admin.api.client.download',
    ariaLabel: 'admin.api.client.download',
    layout: 'pill',
    palette: 'blue',
    surface: 'tinted',
    href: () => this.integrationDocumentationUrl,
    target: '_blank',
    rel: 'noopener noreferrer'
  }];
  protected readonly generateTokenActions = computed<readonly AppMenuItem[]>(() => [{
    id: 'generate-integration-token',
    kind: 'action',
    icon: 'key',
    label: 'integration.token.generate',
    ariaLabel: 'integration.token.generate.aria',
    layout: 'action',
    palette: 'blue',
    disabled: !this.canGenerate(),
    progress: this.mutating() ? { state: 'loading', shape: 'button' } : null
  }]);

  protected readonly popupModel = computed<PopupModel>(() => {
    return {
      errorMessage: this.errorMessage(),
      title: this.adminMode || this.roleReadOnly ? 'integration.roles.title' : 'affiliate.title',
      subtitle: this.adminMode || this.roleReadOnly ? 'integration.roles.summary' : 'affiliate.subtitle',
      ariaLabel: this.adminMode ? 'admin.api.title' : 'affiliate.open',
      closeAriaLabel: 'close',
      size: 'small',
      height: 'auto',
      mobilePresentation: 'fullscreen',
      backdropTone: 'dim',
      headerControls: this.adminMode || !this.settings() ? [] : [{
        kind: 'menu', id: 'affiliate-revenue', model: { density: 'compact' },
        trigger: { id: 'affiliate-revenue', label: 'affiliate.revenue.button', icon: 'account_balance_wallet', collapsible: true,
          ariaLabel: 'affiliate.revenue.open', palette: 'green', layout: 'pill', action: 'custom' }
      }],
      onMenuSelect: () => { if (!this.adminMode) this.revenueOpen.set(true); },
      headerActions: [...(this.store.dirty() ? [{
        id: 'integration-save', icon: 'check', ariaLabel: 'save', palette: 'green' as const,
        disabled: this.mutating() || this.loading(), guideFieldId: 'integration-access-save'
      }] : []), {
        id: 'integration-help',
        icon: 'question_mark',
        ariaLabel: 'integration.help.aria',
        palette: 'blue'
      }],
      onAction: event => this.onPopupAction(event),
      onClose: () => this.closePopup()
    };
  });

  protected helpPopupModel(): PopupModel {
    return {
      title: 'integration.help.title',
      subtitle: this.adminMode || this.roleReadOnly ? 'integration.roles.title' : 'affiliate.title',
      ariaLabel: 'integration.help.aria',
      closeAriaLabel: 'close',
      size: 'small',
      height: 'auto',
      mobilePresentation: 'compact',
      backdropTone: 'dim',
      headerPalette: 'blue',
      onClose: () => this.closeHelp()
    };
  }

  openPopup(event?: Event): void {
    event?.stopPropagation();
    this.open.set(true);
    this.unregisterExplanationContext ??= this.explanationGuide.registerContext('profile.integrations');
    this.revealedToken.set('');
    this.revealedTokenId.set('');
    this.errorMessage.set('');
    void this.store.open(this.adminMode, this.adminMode || this.roleReadOnly);
  }

  ngOnDestroy(): void {
    this.store.close();
    this.closeHelp();
    this.unregisterExplanationContext?.();
    this.unregisterExplanationContext = null;
  }

  protected closePopup(): void {
    if (this.mutating()) return;
    this.open.set(false);
    this.store.close();
    this.closeHelp();
    this.unregisterExplanationContext?.();
    this.unregisterExplanationContext = null;
    this.helpOpen.set(false);
    this.revenueOpen.set(false);
    this.revealedToken.set('');
    this.revealedTokenId.set('');
    this.copiedValue.set('');
  }

  private closeHelp(): void {
    this.helpOpen.set(false);
    this.unregisterHelpContext?.();
    this.unregisterHelpContext = null;
  }

  private onPopupAction(event: PopupActionEvent): void {
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'integration-help') {
      this.helpOpen.set(true);
      this.unregisterHelpContext ??= this.explanationGuide.registerContext('profile.integration-help');
    } else if (event.action.id === 'integration-save') {
      void this.store.save().then(saved => { if (saved) this.closePopup(); });
    }
  }

  protected requestGenerate(): void {
    if (!this.canGenerate()) {
      return;
    }
    const name = this.i18nService.translateParams(
      'integration.token.client.name',
      { index: (this.settings()?.tokens.length ?? 0) + 1 }
    );
    const expiresInDays = 90;
    this.dialogStore.open({
      title: 'integration.token.generate.confirm.title',
      message: this.i18nService.translateParams(
        'integration.token.generate.confirm.message',
        { name, days: expiresInDays }
      ),
      confirmLabel: 'integration.token.generate.confirm',
      busyConfirmLabel: 'integration.token.generating',
      confirmTone: 'accent',
      failureMessage: 'integration.token.generate.failed',
      onConfirm: async () => {
          const created = await this.store.createApi(name, expiresInDays);
          if (!created) return;
          this.revealedToken.set(created.value);
          this.revealedTokenId.set(created.token.id);
      }
    });
  }

  protected requestRevoke(token: IntegrationTokenDto): void {
    if (this.mutating()) {
      return;
    }
    this.dialogStore.open({
      title: 'integration.token.revoke.confirm.title',
      message: this.i18nService.translateParams(
        'integration.token.revoke.confirm.message',
        { name: token.name }
      ),
      warningMessage: 'integration.token.revoke.warning',
      confirmLabel: 'integration.token.revoke',
      busyConfirmLabel: 'integration.token.revoking',
      confirmTone: 'danger',
      failureMessage: 'integration.token.revoke.failed',
      onConfirm: async () => {
        await this.store.revokeApi(token.id);
        if (this.revealedTokenId() === token.id) { this.revealedToken.set(''); this.revealedTokenId.set(''); }
      }
    });
  }

  protected onGenerateTokenAction(event: AppMenuItemSelectEvent): void {
    if (event.id === 'generate-integration-token') {
      this.requestGenerate();
    }
  }

  protected revokeTokenActions(token: IntegrationTokenDto): readonly AppMenuItem<string, IntegrationActionContext>[] {
    return [{
      id: `revoke-integration-token-${token.id}`,
      kind: 'action',
      icon: 'delete',
      ariaLabel: this.i18nService.translateParams(
        'integration.token.revoke.aria',
        { name: token.name }
      ),
      layout: 'icon',
      palette: 'danger',
      disabled: this.mutating(),
      context: { action: 'revoke', token }
    }];
  }

  protected copyTokenActions(value: string): readonly AppMenuItem<string, IntegrationActionContext>[] {
    return this.copyMenu('copy-api-token', value, 'integration.token.copy.aria').items;
  }

  protected copyBaseUrlActions(): readonly AppMenuItem<string, IntegrationActionContext>[] {
    return this.copyMenu('copy-base-url', this.baseUrl(), 'integration.base.url.copy.aria').items;
  }

  protected onTokenAction(event: AppMenuItemSelectEvent): void {
    const context = event.context as IntegrationActionContext | undefined;
    if (context?.action === 'revoke') {
      this.requestRevoke(context.token);
    } else if (context?.action === 'copy') {
      void this.copy(context.value);
    }
  }

  protected async copy(value: string): Promise<void> {
    const normalized = value.trim();
    if (!normalized || !globalThis.navigator?.clipboard) {
      return;
    }
    await globalThis.navigator.clipboard.writeText(normalized);
    this.copiedValue.set(normalized);
  }

  protected formatDate(value: string | null): string {
    const date = new Date(value ?? '');
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
      : '—';
  }

  private copyMenu(id: string, value: string, ariaLabel: string) {
    return {
      kind: 'inline' as const,
      layout: 'row' as const,
      model: this.actionMenuModel,
      items: [{
        id,
        kind: 'action' as const,
        icon: this.copiedValue() === value ? 'done' : 'content_copy',
        hideLabel: true,
        ariaLabel,
        layout: 'icon' as const,
        palette: this.copiedValue() === value ? 'green' as const : 'blue' as const,
        context: { action: 'copy', value } satisfies IntegrationActionContext
      }]
    };
  }
}
