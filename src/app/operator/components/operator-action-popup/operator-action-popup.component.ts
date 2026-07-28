import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type {
  DeploymentThemePreset,
  OperatorDeploymentUpdatePhase
} from '../../../shared/core/contracts';
import {
  DEPLOYMENT_THEME_PRESETS
} from '../../../shared/core/contracts';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { ImageCarouselComponent } from '../../../shared/ui/components/core/image-carousel';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { I18nPipe } from '../../../shared/ui/pipes';

type OperatorPopupAction =
  | 'refresh-update'
  | 'apply-update'
  | 'claim-share'
  | 'issue-token'
  | 'redeem-token'
  | 'save-branding'
  | 'register-payment'
  | 'register-firebase'
  | 'test-authentication'
  | 'test-messaging'
  | 'set-theme'
  | 'set-payment-provider';

interface OperatorPopupActionContext {
  action: OperatorPopupAction;
  themePreset?: DeploymentThemePreset;
  providerId?: string | null;
}

@Component({
  selector: 'app-operator-action-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    FormsModule,
    ImageCarouselComponent,
    IndicatorComponent,
    I18nPipe,
    MatIconModule,
    PopupComponent
  ],
  templateUrl: './operator-action-popup.component.html',
  styleUrl: './operator-action-popup.component.scss'
})
export class OperatorActionPopupComponent {
  protected readonly menu = inject(OperatorMenuStore);
  protected readonly workspace = inject(OperatorWorkspaceStore);
  private readonly i18n = inject(I18nService);
  protected readonly kind = computed(() => this.menu.activePopup());
  protected readonly busyAction = this.workspace.busyAction;
  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly loading = computed(() => {
    switch (this.kind()) {
      case 'updates':
        return this.busyAction() === 'load-update' && !this.workspace.deploymentUpdate();
      case 'claim':
        return this.busyAction() === 'load-claim' && !this.workspace.claimStatus();
      case 'configuration':
        return this.busyAction() === 'load-configuration';
      case 'community':
        return this.busyAction() === 'load-community' && !this.workspace.community();
      default:
        return false;
    }
  });
  protected readonly actionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => this.buildActionItems(this.kind()));
  protected readonly configurationThemeItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const selected = this.workspace.configurationDraft()?.branding.themePreset;
    return DEPLOYMENT_THEME_PRESETS.map(themePreset => ({
      id: `operator-theme-${themePreset.toLowerCase()}`,
      label: `operator.configuration.branding.theme.${themePreset.toLowerCase()}`,
      icon: 'palette',
      kind: 'radio',
      palette: this.themePalette(themePreset),
      active: selected === themePreset,
      checked: selected === themePreset,
      context: {
        action: 'set-theme',
        themePreset
      }
    }));
  });
  protected readonly configurationPaymentProviderItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const configuration = this.workspace.configuration();
    const selected = this.workspace.configurationDraft()?.payment.providerId ?? null;
    return [
      {
        id: 'operator-payment-provider-none',
        label: 'operator.configuration.payment.provider.none',
        icon: 'money_off',
        kind: 'radio',
        palette: 'slate',
        active: selected === null,
        checked: selected === null,
        context: {
          action: 'set-payment-provider',
          providerId: null
        }
      },
      ...(configuration?.payment.availableProviders ?? []).map(provider => ({
        id: `operator-payment-provider-${provider.id}`,
        label: provider.label,
        icon: provider.logoUrl ? undefined : 'payments',
        imageUrl: provider.logoUrl,
        imageAlt: provider.logoAlt,
        kind: 'radio' as const,
        palette: provider.palette ?? undefined,
        surface: 'tinted' as const,
        active: selected === provider.id,
        checked: selected === provider.id,
        context: {
          action: 'set-payment-provider' as const,
          providerId: provider.id
        }
      }))
    ];
  });
  protected readonly configurationBrandingActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const draft = this.workspace.configurationDraft();
    return [{
      id: 'operator-save-branding',
      label: 'operator.configuration.branding.save',
      icon: 'save',
      palette: 'blue',
      layout: 'action',
      disabled: this.configurationDisabled()
        || !draft?.branding.productName.trim()
        || !draft?.branding.homeLabel.trim(),
      progress: this.busyAction() === 'save-branding'
        ? { state: 'loading', durationMs: 3000 }
        : null,
      context: { action: 'save-branding' }
    }];
  });
  protected readonly configurationPaymentActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const configuration = this.workspace.configuration();
    const draft = this.workspace.configurationDraft();
    const mode = this.paymentActionMode();
    const hasCredential = Boolean(draft?.payment.credential.trim());
    const removing = mode === 'remove';
    return [{
      id: `operator-${mode}-payment`,
      label: `operator.configuration.payment.${mode}`,
      detail: configuration?.payment.credentialConfigured
        ? configuration.payment.credentialMask
          || 'operator.configuration.configured'
        : 'operator.configuration.not.configured',
      icon: removing ? 'delete_outline' : 'payments',
      palette: removing ? 'red' : 'green',
      layout: 'action',
      disabled: this.configurationDisabled()
        || (!removing && (!draft?.payment.providerId || !hasCredential)),
      progress: this.busyAction() === 'register-payment'
        ? { state: 'loading', durationMs: 3000 }
        : null,
      context: { action: 'register-payment' }
    }];
  });
  protected readonly configurationFirebaseSaveActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const draft = this.workspace.configurationDraft();
    return [{
      id: 'operator-save-firebase',
      label: 'operator.configuration.firebase.save',
      icon: 'save',
      palette: 'orange',
      layout: 'action',
      disabled: this.configurationDisabled()
        || !draft?.firebase.projectId.trim(),
      progress: this.busyAction() === 'register-firebase'
        ? { state: 'loading', durationMs: 3000 }
        : null,
      context: { action: 'register-firebase' }
    }];
  });
  protected readonly configurationFirebaseTestActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const configuration = this.workspace.configuration();
    const authenticationFeedback =
      this.workspace.configurationAuthenticationFeedback();
    const messagingFeedback = this.workspace.configurationMessagingFeedback();
    return [
      {
        id: 'operator-test-authentication',
        label: 'operator.configuration.test.authentication.short',
        icon: authenticationFeedback === 'success'
          ? 'check_circle'
          : authenticationFeedback === 'error'
            ? 'error_outline'
            : 'verified_user',
        palette: authenticationFeedback === 'success'
          ? 'green'
          : authenticationFeedback === 'error'
            ? 'red'
            : 'blue',
        layout: 'action',
        disabled: this.configurationDisabled()
          || !configuration?.firebase.authenticationCredentialConfigured
          || authenticationFeedback !== null,
        progress: this.busyAction() === 'test-authentication'
          ? { state: 'loading', durationMs: 3000 }
          : authenticationFeedback
            ? { state: authenticationFeedback, durationMs: 1000 }
            : null,
        context: { action: 'test-authentication' }
      },
      {
        id: 'operator-test-messaging',
        label: 'operator.configuration.test.messaging.short',
        icon: messagingFeedback === 'success'
          ? 'check_circle'
          : messagingFeedback === 'error'
            ? 'error_outline'
            : 'notifications_active',
        palette: messagingFeedback === 'success'
          ? 'green'
          : messagingFeedback === 'error'
            ? 'red'
            : 'orange',
        layout: 'action',
        disabled: this.configurationDisabled()
          || !configuration?.firebase.messagingCredentialConfigured
          || messagingFeedback !== null,
        progress: this.busyAction() === 'test-messaging'
          ? { state: 'loading', durationMs: 3000 }
          : messagingFeedback
            ? { state: messagingFeedback, durationMs: 1000 }
            : null,
        context: { action: 'test-messaging' }
      }
    ];
  });
  private loadedKind: OperatorMenuKind | null = null;

  constructor() {
    effect(() => {
      const kind = this.kind();
      if (!kind || kind === 'registration') {
        this.loadedKind = null;
        return;
      }
      if (kind === this.loadedKind) {
        return;
      }
      this.loadedKind = kind;
      this.workspace.clearFeedback();
      void this.load(kind);
    });
  }

  protected popupModel(): PopupModel {
    const kind = this.kind();
    const wide = kind === 'configuration' || kind === 'community';
    return {
      title: this.titleKey(kind),
      subtitle: this.subtitleKey(kind),
      ariaLabel: this.titleKey(kind),
      closeAriaLabel: 'operator.popup.close',
      size: wide ? 'wide' : 'small',
      height: wide ? 'full' : 'auto',
      mobilePresentation: wide ? 'fullscreen' : 'compact',
      headerTone: 'accent',
      headerPalette: this.headerPalette(kind),
      bodyLayout: 'default',
      onClose: () => this.close()
    };
  }

  protected async onAction(
    event: AppMenuItemSelectEvent<string, OperatorPopupActionContext>
  ): Promise<void> {
    const context = event.context;
    switch (context?.action) {
      case 'refresh-update':
        await this.workspace.refreshDeploymentUpdate();
        return;
      case 'apply-update':
        await this.workspace.applyDeploymentUpdate();
        return;
      case 'issue-token':
        await this.workspace.issueGroupingToken();
        return;
      case 'claim-share':
        await this.workspace.claimShare();
        return;
      case 'redeem-token':
        await this.workspace.linkOperatorGroup();
        return;
      case 'save-branding':
        await this.workspace.saveConfiguration(
          'save-branding',
          'operator.configuration.branding.saved'
        );
        return;
      case 'register-payment':
        await this.workspace.saveConfiguration(
          'register-payment',
          `operator.configuration.payment.${this.paymentActionMode()}.completed`
        );
        return;
      case 'register-firebase':
        await this.workspace.saveConfiguration(
          'register-firebase',
          'operator.configuration.firebase.saved'
        );
        return;
      case 'test-authentication':
        await this.workspace.testConfiguration('FIREBASE_AUTHENTICATION');
        return;
      case 'test-messaging':
        await this.workspace.testConfiguration('FIREBASE_MESSAGING');
        return;
      case 'set-theme':
        if (context.themePreset) {
          this.workspace.setConfigurationBranding({
            themePreset: context.themePreset
          });
        }
        return;
      case 'set-payment-provider':
        this.workspace.setConfigurationPayment({
          providerId: context.providerId ?? null,
          credential: ''
        });
        return;
      default:
        return;
    }
  }

  protected close(): void {
    this.workspace.clearFeedback();
    this.menu.closePopup();
  }

  protected formatDate(value: string | null | undefined): string {
    const timestamp = Date.parse(`${value ?? ''}`);
    if (!Number.isFinite(timestamp)) {
      return '—';
    }
    return new Intl.DateTimeFormat(this.i18n.currentLanguage(), {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  protected formatShare(value: number): string {
    return new Intl.NumberFormat(this.i18n.currentLanguage(), {
      minimumFractionDigits: value > 0 && value < 1 ? 2 : 1,
      maximumFractionDigits: 2
    }).format(Math.max(0, value));
  }

  protected formatBytes(value: number): string {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${new Intl.NumberFormat(this.i18n.currentLanguage(), {
      maximumFractionDigits: size < 10 ? 1 : 0
    }).format(size)} ${units[unitIndex]}`;
  }

  protected updatePhaseLabel(phase: OperatorDeploymentUpdatePhase): string {
    return `operator.update.phase.${phase.toLowerCase()}`;
  }

  protected configurationThemeTrigger(): AppMenuTrigger {
    const themePreset =
      this.workspace.configurationDraft()?.branding.themePreset ?? 'AURORA';
    return {
      label: `operator.configuration.branding.theme.${themePreset.toLowerCase()}`,
      icon: 'palette',
      palette: this.themePalette(themePreset),
      layout: 'field',
      disabled: this.configurationDisabled(),
      ariaLabel: 'operator.configuration.branding.theme'
    };
  }

  protected configurationPaymentProviderTrigger(): AppMenuTrigger {
    const configuration = this.workspace.configuration();
    const selected = this.workspace.configurationDraft()?.payment.providerId ?? null;
    const provider = configuration?.payment.availableProviders
      .find(item => item.id === selected);
    return {
      label: provider?.label ?? 'operator.configuration.payment.provider.none',
      icon: provider
        ? provider.logoUrl
          ? undefined
          : 'payments'
        : 'money_off',
      imageUrl: provider?.logoUrl,
      imageAlt: provider?.logoAlt,
      palette: provider?.palette ?? (provider ? undefined : 'slate'),
      layout: 'field',
      disabled: this.configurationDisabled(),
      ariaLabel: 'operator.configuration.payment.provider'
    };
  }

  protected configurationDisabled(): boolean {
    return this.busy()
      || this.workspace.configuration()?.capability !== 'AVAILABLE';
  }

  protected onBrandingLogoChange(imageUrls: readonly string[]): void {
    this.workspace.setConfigurationBranding({
      logoUrl: imageUrls[0] ?? ''
    });
  }

  protected safeExternalUrl(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  protected busyLabel(): string {
    switch (this.busyAction()) {
      case 'issue-grouping-token':
        return 'operator.group.token.issuing';
      case 'claim-share':
        return 'operator.claim.applying';
      case 'link-operator-group':
        return 'operator.group.linking';
      case 'apply-update':
        return 'operator.update.applying';
      case 'test-authentication':
      case 'test-messaging':
        return 'operator.configuration.testing';
      case 'save-branding':
      case 'register-payment':
      case 'register-firebase':
        return 'operator.configuration.saving';
      case 'set-community':
        return 'operator.community.updating';
      default:
        return 'operator.loading';
    }
  }

  private async load(kind: Exclude<OperatorMenuKind, 'registration'>): Promise<void> {
    switch (kind) {
      case 'updates':
        // The operator page loads this once with the workspace. Opening the
        // popup must only reveal the cached snapshot.
        return;
      case 'claim':
        await this.workspace.loadClaimStatus();
        return;
      case 'configuration':
        await this.workspace.loadConfiguration();
        return;
      case 'community':
        await this.workspace.loadCommunityStatus();
        return;
    }
  }

  private buildActionItems(
    kind: OperatorMenuKind | null
  ): readonly AppMenuItem<string, OperatorPopupActionContext>[] {
    switch (kind) {
      case 'updates': {
        const update = this.workspace.deploymentUpdate();
        return [
          {
            id: 'operator-refresh-update',
            label: 'operator.update.refresh',
            icon: 'refresh',
            palette: 'blue',
            layout: 'action',
            disabled: this.busy(),
            progress: this.busyAction() === 'load-update'
              ? { state: 'loading', durationMs: 3000 }
              : null,
            context: { action: 'refresh-update' }
          },
          {
            id: 'operator-apply-update',
            label: update?.updateAvailable
              ? 'operator.update.apply'
              : 'operator.update.current',
            icon: update?.updateAvailable ? 'system_update_alt' : 'check_circle',
            palette: 'teal',
            layout: 'action',
            disabled: this.busy() || !update?.updateAvailable,
            progress: this.busyAction() === 'apply-update'
              ? { state: 'loading', durationMs: 3000 }
              : null,
            context: { action: 'apply-update' }
          }
        ];
      }
      case 'claim': {
        if (!this.workspace.claimStatus()?.claimed) {
          return [{
            id: 'operator-claim-share',
            label: 'operator.claim.apply',
            icon: 'verified',
            palette: 'purple',
            layout: 'action',
            disabled: this.busy() || !this.workspace.claimVerificationReady(),
            progress: this.busyAction() === 'claim-share'
              ? { state: 'loading', durationMs: 3000 }
              : null,
            context: { action: 'claim-share' }
          }];
        }
        const token = this.workspace.groupingToken();
        return [
          {
            id: 'operator-issue-token',
            label: token ? 'operator.group.token.refresh' : 'operator.group.token.request',
            icon: 'vpn_key',
            palette: 'purple',
            layout: 'action',
            disabled: this.busy(),
            progress: this.busyAction() === 'issue-grouping-token'
              ? { state: 'loading', durationMs: 3000 }
              : null,
            context: { action: 'issue-token' }
          },
          ...(this.workspace.groupTokenInput().trim()
            ? [{
                id: 'operator-redeem-token',
                label: 'operator.group.redeem',
                icon: 'redeem',
                palette: 'green' as const,
                layout: 'action' as const,
                disabled: this.busy(),
                progress: this.busyAction() === 'link-operator-group'
                  ? { state: 'loading' as const, durationMs: 3000 }
                  : null,
                context: { action: 'redeem-token' as const }
              }]
            : [])
        ];
      }
      case 'configuration':
      case 'community':
      default:
        return [];
    }
  }

  private paymentActionMode(): 'register' | 'update' | 'remove' {
    const configuration = this.workspace.configuration();
    const selectedProvider = this.workspace.configurationDraft()?.payment.providerId ?? null;
    const registeredProvider = configuration?.payment.providerId ?? null;
    if (!selectedProvider && registeredProvider) {
      return 'remove';
    }
    if (
      selectedProvider
      && selectedProvider === registeredProvider
      && configuration?.payment.credentialConfigured
    ) {
      return 'update';
    }
    return 'register';
  }

  private titleKey(kind: OperatorMenuKind | null): string {
    switch (kind) {
      case 'updates':
        return 'operator.action.updates';
      case 'claim':
        return 'operator.action.claim.share';
      case 'configuration':
        return 'operator.action.configuration';
      case 'community':
        return 'operator.community';
      default:
        return 'operator';
    }
  }

  private subtitleKey(kind: OperatorMenuKind | null): string {
    switch (kind) {
      case 'updates':
        return 'operator.update.subtitle';
      case 'claim':
        return 'operator.claim.subtitle';
      case 'configuration':
        return 'operator.configuration.subtitle';
      case 'community':
        return 'operator.community.subtitle';
      default:
        return '';
    }
  }

  private headerPalette(
    kind: OperatorMenuKind | null
  ): 'teal' | 'violet' | 'blue' | 'slate' {
    switch (kind) {
      case 'updates':
        return 'teal';
      case 'claim':
        return 'violet';
      case 'configuration':
        return 'blue';
      case 'community':
      default:
        return 'slate';
    }
  }

  private themePalette(
    themePreset: DeploymentThemePreset
  ): 'blue' | 'teal' | 'green' | 'orange' | 'violet' | 'rose' | 'amber' | 'slate' {
    switch (themePreset) {
      case 'OCEAN':
        return 'blue';
      case 'FOREST':
        return 'green';
      case 'SUNSET':
        return 'orange';
      case 'VIOLET':
        return 'violet';
      case 'ROSE':
        return 'rose';
      case 'AMBER':
        return 'amber';
      case 'SLATE':
      case 'MONOCHROME':
        return 'slate';
      case 'AQUARIUS':
        return 'teal';
      case 'AURORA':
      default:
        return 'violet';
    }
  }
}
