import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { IntegrationService } from '../../../shared/core';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type {
  IntegrationSettingsDto,
  IntegrationTokenDto
} from '../../../shared/core/contracts/integration.interface';
import { PopupComponent, type PopupActionEvent, type PopupModel } from '../../../shared/ui';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel
} from '../../../shared/ui/components/core/menu';
import { I18nPipe } from '../../../shared/ui/pipes/i18n.pipe';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';

type IntegrationActionContext =
  | { action: 'copy'; value: string }
  | { action: 'revoke'; token: IntegrationTokenDto };

@Component({
  selector: 'app-integration-settings-popup',
  standalone: true,
  imports: [
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
export class IntegrationSettingsPopupComponent {
  private readonly integrationService = inject(IntegrationService);
  private readonly i18nService = inject(I18nService);
  private readonly dialogStore = inject(DialogStore);

  protected readonly open = signal(false);
  protected readonly helpOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly mutating = signal(false);
  protected readonly settings = signal<IntegrationSettingsDto | null>(null);
  protected readonly revealedToken = signal('');
  protected readonly revealedTokenId = signal('');
  protected readonly errorMessage = signal('');
  protected readonly copiedValue = signal('');
  protected readonly baseUrl = computed(() => this.integrationService.absoluteBaseUrl(this.settings()?.baseUrl ?? ''));
  protected readonly canGenerate = computed(() => {
    const settings = this.settings();
    return !!settings && settings.tokens.length < settings.maxActiveTokens && !this.mutating();
  });
  protected readonly actionMenuModel: AppMenuModel = { actionSizing: 'content' };
  protected readonly integrationDocumentationUrl = 'https://github.com/fssrepository/myscoutee-backend#documentation-pdfs';
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

  protected popupModel(): PopupModel {
    return {
      title: 'integration.title',
      subtitle: 'integration.subtitle',
      ariaLabel: 'integration.aria',
      closeAriaLabel: 'close',
      size: 'small',
      height: 'auto',
      mobilePresentation: 'compact',
      backdropTone: 'dim',
      headerActions: [{
        id: 'integration-help',
        icon: 'help',
        ariaLabel: 'integration.help.aria',
        palette: 'blue'
      }],
      onAction: event => this.onPopupAction(event),
      onClose: () => this.closePopup()
    };
  }

  protected helpPopupModel(): PopupModel {
    return {
      title: 'integration.help.title',
      subtitle: 'integration.title',
      ariaLabel: 'integration.help.aria',
      closeAriaLabel: 'close',
      size: 'small',
      height: 'auto',
      mobilePresentation: 'compact',
      backdropTone: 'dim',
      headerPalette: 'blue',
      onClose: () => this.helpOpen.set(false)
    };
  }

  openPopup(event?: Event): void {
    event?.stopPropagation();
    this.open.set(true);
    this.revealedToken.set('');
    this.revealedTokenId.set('');
    this.errorMessage.set('');
    void this.loadSettings();
  }

  protected closePopup(): void {
    this.open.set(false);
    this.helpOpen.set(false);
    this.revealedToken.set('');
    this.revealedTokenId.set('');
    this.copiedValue.set('');
  }

  private onPopupAction(event: PopupActionEvent): void {
    event.sourceEvent.stopPropagation();
    if (event.action.id === 'integration-help') {
      this.helpOpen.set(true);
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
        this.mutating.set(true);
        try {
          const created = await this.integrationService.createToken(name, expiresInDays);
          this.revealedToken.set(created.value);
          this.revealedTokenId.set(created.token.id);
          await this.loadSettings(false);
        } finally {
          this.mutating.set(false);
        }
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
        this.mutating.set(true);
        try {
          await this.integrationService.revokeToken(token.id);
          await this.loadSettings(false);
        } finally {
          this.mutating.set(false);
        }
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

  private async loadSettings(showLoading = true): Promise<void> {
    if (showLoading) {
      this.loading.set(true);
    }
    this.errorMessage.set('');
    try {
      this.settings.set(await this.integrationService.loadSettings());
    } catch {
      this.errorMessage.set('integration.load.failed');
    } finally {
      if (showLoading) {
        this.loading.set(false);
      }
    }
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
