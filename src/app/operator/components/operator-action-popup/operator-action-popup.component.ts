import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import type {
  DeploymentSocialLinkDto,
  DeploymentThemePreset,
  ListQuery,
  OperatorClaimRequestDto,
  OperatorDeploymentUpdatePhase,
  OperatorLeaderboardDeploymentDto,
  OperatorRevenueReportDto,
  OperatorRevenueReportFilters,
  OperatorRevenueSyncState
} from '../../../shared/core/contracts';
import {
  DEPLOYMENT_THEME_PRESETS
} from '../../../shared/core/contracts';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { ImageCarouselComponent } from '../../../shared/ui/components/core/image-carousel';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  FormFlowComponent,
  type FormFlowModel
} from '../../../shared/ui/components/core/form';
import {
  LinkInputComponent,
  type LinkInputConfig
} from '../../../shared/ui/components/core/form/inputs';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  SingleRowComponent,
  SmartListComponent,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui/components/core/smart-list';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import {
  OperatorLeaderboardStore,
  type OperatorLeaderboardDeploymentFilters
} from '../../../shared/ui/context/stores/operator-leaderboard.store';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { I18nPipe } from '../../../shared/ui/pipes';
import { OperatorRevenueViewComponent } from '../operator-revenue-view/operator-revenue-view.component';

type OperatorPopupAction =
  | 'refresh-update'
  | 'apply-update'
  | 'claim-share'
  | 'redeem-token'
  | 'set-claim-path'
  | 'save-branding'
  | 'save-admin-emails'
  | 'save-privacy-contact'
  | 'add-social-link'
  | 'remove-social-link'
  | 'save-social-links'
  | 'register-payment'
  | 'register-firebase'
  | 'activate-firebase'
  | 'test-authentication'
  | 'test-messaging'
  | 'synchronize-revenue'
  | 'requeue-revenue-report'
  | 'set-theme'
  | 'set-payment-provider';

type OperatorClaimPath = 'company' | 'client-code';

interface OperatorPopupActionContext {
  action: OperatorPopupAction;
  claimPath?: OperatorClaimPath;
  themePreset?: DeploymentThemePreset;
  providerId?: string | null;
  reportId?: string;
  socialLinkIndex?: number;
}

@Component({
  selector: 'app-operator-action-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    FormFlowComponent,
    FormsModule,
    ImageCarouselComponent,
    IndicatorComponent,
    LinkInputComponent,
    I18nPipe,
    MatIconModule,
    OperatorRevenueViewComponent,
    PopupComponent,
    SingleRowComponent,
    SmartListComponent
  ],
  templateUrl: './operator-action-popup.component.html',
  styleUrl: './operator-action-popup.component.scss'
})
export class OperatorActionPopupComponent {
  protected readonly menu = inject(OperatorMenuStore);
  protected readonly registry = inject(OperatorRegistryStore);
  protected readonly workspace = inject(OperatorWorkspaceStore);
  private readonly leaderboard = inject(OperatorLeaderboardStore);
  private readonly dialog = inject(DialogStore);
  private readonly i18n = inject(I18nService);
  protected readonly claimPath = signal<OperatorClaimPath>('company');
  protected readonly requeueingReportId = signal<string | null>(null);
  private readonly revenueReportsSmartListRef = signal<
    SmartListComponent<OperatorRevenueReportDto, OperatorRevenueReportFilters> | null
  >(null);

  @ViewChild('revenueReportsSmartList')
  protected set revenueReportsSmartList(
    value: SmartListComponent<
      OperatorRevenueReportDto,
      OperatorRevenueReportFilters
    > | undefined
  ) {
    this.revenueReportsSmartListRef.set(value ?? null);
  }

  protected readonly kind = computed(() => this.menu.activePopup());
  protected readonly busyAction = this.workspace.busyAction;
  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly loading = computed(() => {
    switch (this.kind()) {
      case 'updates':
        return this.busyAction() === 'load-update' && !this.workspace.deploymentUpdate();
      case 'claim':
        return this.busyAction() === 'load-claim';
      case 'configuration':
        return this.busyAction() === 'load-configuration';
      case 'revenue':
        return this.busyAction() === 'load-revenue' && !this.workspace.revenue();
      case 'community':
        return this.busyAction() === 'load-community' && !this.workspace.community();
      default:
        return false;
    }
  });
  protected readonly actionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => this.buildActionItems(this.kind()));
  protected readonly revenueReportQuery = computed<
    Partial<ListQuery<OperatorRevenueReportFilters>>
  >(() => ({
    page: 0,
    pageSize: 5,
    sort: 'period',
    direction: 'desc',
    filters: {
      status: 'BLOCKED',
      revision: this.workspace.revenueSync()?.synchronizedAtIso ?? ''
    }
  }));
  protected readonly revenueReportConfig: SmartListConfig<
    OperatorRevenueReportDto,
    OperatorRevenueReportFilters
  > = {
    pageSize: 5,
    initialPageSize: 5,
    defaultView: 'list',
    emptyLabel: 'operator.revenue.delivery.reports.empty',
    emptyDescription: 'operator.revenue.delivery.reports.empty.description',
    showStickyHeader: false,
    showFirstGroupMarker: false,
    listLayout: 'stack',
    snapMode: 'none',
    preloadOffsetPx: 120,
    headerProgress: {
      enabled: true,
      placement: 'inline',
      tone: 'accent'
    },
    cacheable: {
      identity: report => report.id
    },
    trackBy: (_index, report) => report.id
  };
  protected readonly loadRevenueReportPage: SmartListLoadPage<
    OperatorRevenueReportDto,
    OperatorRevenueReportFilters
  > = (query, context) => from(
    this.workspace.revenueReportPage(query, context?.signal)
  );
  protected readonly leaderboardDeploymentQuery = computed<
    Partial<ListQuery<OperatorLeaderboardDeploymentFilters>>
  >(() => ({
    page: 0,
    pageSize: 8,
    filters: {
      groupId:
        this.menu.selectedLeaderboardEntry()?.operatorGroupId?.trim() ?? ''
    }
  }));
  protected readonly leaderboardDeploymentConfig: SmartListConfig<
    OperatorLeaderboardDeploymentDto,
    OperatorLeaderboardDeploymentFilters
  > = {
    pageSize: 8,
    initialPageSize: 8,
    defaultView: 'list',
    emptyLabel: 'operator.leaderboard.deployments.empty',
    emptyDescription:
      'operator.leaderboard.deployments.empty.description',
    showStickyHeader: false,
    showFirstGroupMarker: false,
    listLayout: 'stack',
    snapMode: 'none',
    preloadOffsetPx: 160,
    headerProgress: {
      enabled: true,
      placement: 'inline',
      tone: 'accent'
    },
    cacheable: {
      identity: deployment => deployment.deploymentId
    },
    containerClass: {
      'operator-leaderboard-deployment-smart-list': true
    },
    trackBy: (_index, deployment) => deployment.deploymentId
  };
  protected readonly loadLeaderboardDeploymentPage: SmartListLoadPage<
    OperatorLeaderboardDeploymentDto,
    OperatorLeaderboardDeploymentFilters
  > = (query, context) => from(
    this.leaderboard.queryDeploymentPage(query, context?.signal)
  );
  protected readonly claimPathItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => [
    {
      id: 'operator-claim-path-company',
      label: 'operator.claim.path.company',
      description: 'operator.claim.path.company.description',
      icon: 'business',
      kind: 'radio',
      layout: 'pill',
      palette: 'blue',
      active: this.claimPath() === 'company',
      checked: this.claimPath() === 'company',
      disabled: this.busy(),
      context: {
        action: 'set-claim-path',
        claimPath: 'company'
      }
    },
    {
      id: 'operator-claim-path-client-code',
      label: 'operator.claim.path.client.code',
      description: 'operator.claim.path.client.code.description',
      icon: 'key',
      kind: 'radio',
      layout: 'pill',
      palette: 'teal',
      active: this.claimPath() === 'client-code',
      checked: this.claimPath() === 'client-code',
      disabled: this.busy() || !this.registeredForClaim(),
      context: {
        action: 'set-claim-path',
        claimPath: 'client-code'
      }
    }
  ]);
  protected readonly claimCompanyFormModel = computed<FormFlowModel>(() => {
    this.i18n.revision();
    const translate = (key: string): string => this.i18n.translate(key);
    return {
      title: translate('operator.claim.path.company'),
      layout: 'grouped',
      header: false,
      save: null,
      completion: { controls: 'required' },
      steps: [
        {
          id: 'operator-claim-company',
          title: translate('operator.claim.verification.company'),
          icon: 'business',
          palette: 'purple',
          controls: [
            {
              id: 'operator-claim-legal-name',
              bind: 'legalName',
              kind: 'text',
              layout: 'half',
              label: translate('operator.claim.verification.legal.name'),
              required: true,
              maxLength: 160
            },
            {
              id: 'operator-claim-registration-number',
              bind: 'registrationNumber',
              kind: 'text',
              layout: 'half',
              label: translate('operator.claim.verification.registration.number'),
              required: true,
              maxLength: 80
            },
            {
              id: 'operator-claim-jurisdiction',
              bind: 'jurisdiction',
              kind: 'text',
              layout: 'half',
              label: translate('operator.claim.verification.jurisdiction'),
              required: true,
              maxLength: 80
            },
            {
              id: 'operator-claim-website',
              bind: 'website',
              kind: 'link',
              layout: 'half',
              label: translate('operator.claim.verification.website'),
              placeholder: 'https://',
              required: true,
              maxLength: 2048,
              validationError: value => {
                const website = `${value ?? ''}`.trim();
                return website && !this.validClaimWebsite(website)
                  ? translate('operator.claim.verification.error.website')
                  : null;
              }
            },
            {
              id: 'operator-claim-registered-address',
              bind: 'registeredAddress',
              kind: 'textarea',
              layout: 'wide',
              label: translate('operator.claim.verification.registered.address'),
              required: true,
              rows: 3,
              maxLength: 500
            }
          ]
        },
        {
          id: 'operator-claim-authority',
          title: translate('operator.claim.verification.authority'),
          icon: 'verified_user',
          palette: 'blue',
          controls: [
            {
              id: 'operator-claim-contact-name',
              bind: 'verificationContactName',
              kind: 'text',
              layout: 'half',
              label: translate('operator.claim.verification.contact.name'),
              required: true,
              maxLength: 120
            },
            {
              id: 'operator-claim-contact-role',
              bind: 'verificationContactRole',
              kind: 'text',
              layout: 'half',
              label: translate('operator.claim.verification.contact.role'),
              required: true,
              maxLength: 120
            },
            {
              id: 'operator-claim-contact-email',
              bind: 'verificationContactEmail',
              kind: 'text',
              layout: 'wide',
              label: translate('operator.claim.verification.contact.email'),
              required: true,
              maxLength: 254,
              validationError: value => {
                const contactEmail = `${value ?? ''}`.trim();
                return contactEmail && !this.validClaimEmail(contactEmail)
                  ? translate('operator.claim.verification.error.email')
                  : null;
              }
            },
            {
              id: 'operator-claim-attestation',
              bind: 'authorityAttested',
              kind: 'checkbox',
              layout: 'wide',
              label: translate('operator.claim.verification.attestation'),
              required: true
            }
          ]
        }
      ]
    };
  });
  protected readonly claimClientCodeFormModel = computed<FormFlowModel>(() => {
    this.i18n.revision();
    const translate = (key: string): string => this.i18n.translate(key);
    return {
      title: translate('operator.claim.path.client.code'),
      layout: 'grouped',
      header: false,
      save: null,
      completion: { controls: 'required' },
      steps: [{
        id: 'operator-claim-client-code',
        title: translate('operator.claim.client.code'),
        subtitle: translate('operator.claim.client.code.instructions'),
        icon: 'key',
        palette: 'teal',
        controls: [{
          id: 'operator-claim-client-code-value',
          bind: 'clientToken',
          kind: 'text',
          layout: 'wide',
          label: translate('operator.claim.client.code'),
          placeholder: translate('operator.claim.client.code.placeholder'),
          required: true,
          maxLength: 500
        }]
      }]
    };
  });
  protected readonly claimClientCodeValue = computed(() => ({
    clientToken: this.workspace.groupTokenInput()
  }));
  protected readonly configurationAdminEmailsFormModel =
    computed<FormFlowModel>(() => {
      this.i18n.revision();
      const translate = (key: string): string => this.i18n.translate(key);
      return {
        title: translate('operator.configuration.admin'),
        layout: 'grouped',
        header: false,
        save: null,
        completion: { controls: 'none' },
        steps: [{
          id: 'operator-configuration-admin-emails',
          title: '',
          chrome: 'none',
          controls: [{
            id: 'operator-configuration-admin-email-list',
            bind: 'adminEmailsText',
            kind: 'textarea',
            layout: 'wide',
            label: translate('operator.configuration.admin.emails'),
            placeholder: translate(
              'operator.configuration.admin.emails.placeholder'
            ),
            rows: 4,
            maxLength: 8192,
            validationError: () =>
              this.workspace.configurationAdminEmailsValidationKey()
          }]
        }]
      };
    });
  protected readonly configurationAdminEmailsFormValue = computed(() => ({
    adminEmailsText: this.workspace.configurationAdminEmailsInput()
  }));
  protected readonly configurationPrivacyContactFormModel =
    computed<FormFlowModel>(() => {
      this.i18n.revision();
      const translate = (key: string): string => this.i18n.translate(key);
      return {
        title: translate('operator.configuration.privacy.contact'),
        layout: 'grouped',
        header: false,
        save: null,
        completion: { controls: 'none' },
        steps: [{
          id: 'operator-configuration-privacy-contact',
          title: '',
          chrome: 'none',
          controls: [
            {
              id: 'operator-configuration-data-controller-name',
              bind: 'dataControllerName',
              kind: 'text',
              layout: 'half',
              label: translate(
                'operator.configuration.privacy.controller.name'
              ),
              placeholder: translate(
                'operator.configuration.privacy.controller.name.placeholder'
              ),
              maxLength: 160,
              validationError: () =>
                this.workspace.configurationPrivacyContactValidationKey()
            },
            {
              id: 'operator-configuration-privacy-contact-email',
              bind: 'privacyContactEmail',
              kind: 'text',
              layout: 'half',
              label: translate(
                'operator.configuration.privacy.contact.email'
              ),
              placeholder: translate(
                'operator.configuration.privacy.contact.email.placeholder'
              ),
              maxLength: 254,
              validationError: () =>
                this.workspace.configurationPrivacyContactValidationKey()
            }
          ]
        }]
      };
    });
  protected readonly configurationPrivacyContactFormValue = computed(() => ({
    dataControllerName:
      this.workspace.configurationDraft()?.privacyContact.dataControllerName
      ?? '',
    privacyContactEmail:
      this.workspace.configurationDraft()?.privacyContact.privacyContactEmail
      ?? ''
  }));
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
        || !draft
        || !this.workspace.configurationBrandingReady(),
      progress: this.busyAction() === 'save-branding'
        ? { state: 'loading', durationMs: 3000 }
        : null,
      context: { action: 'save-branding' }
    }];
  });
  protected readonly configurationAdminEmailActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => [{
    id: 'operator-save-admin-emails',
    label: 'operator.configuration.admin.save',
    icon: 'save',
    palette: 'orange',
    layout: 'action',
    disabled: this.configurationDisabled()
      || !this.workspace.configurationAdminEmailsReady(),
    progress: this.busyAction() === 'save-admin-emails'
      ? { state: 'loading', durationMs: 3000 }
      : null,
    context: { action: 'save-admin-emails' }
  }]);
  protected readonly configurationPrivacyContactActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => [{
    id: 'operator-save-privacy-contact',
    label: 'operator.configuration.privacy.contact.save',
    icon: 'save',
    palette: 'blue',
    layout: 'action',
    disabled: this.configurationDisabled()
      || !this.workspace.configurationPrivacyContactReady(),
    progress: this.busyAction() === 'save-privacy-contact'
      ? { state: 'loading', durationMs: 3000 }
      : null,
    context: { action: 'save-privacy-contact' }
  }]);
  protected readonly configurationSocialLinkActionItems = computed<
    readonly AppMenuItem<string, OperatorPopupActionContext>[]
  >(() => {
    const count =
      this.workspace.configurationDraft()?.socialLinks.length ?? 0;
    return [
      {
        id: 'operator-add-social-link',
        label: 'operator.configuration.social.add',
        icon: 'add_link',
        palette: 'teal',
        layout: 'action',
        disabled: this.configurationDisabled() || count >= 12,
        context: { action: 'add-social-link' }
      },
      {
        id: 'operator-save-social-links',
        label: 'operator.configuration.social.save',
        icon: 'save',
        palette: 'green',
        layout: 'action',
        disabled: this.configurationDisabled()
          || !this.workspace.configurationSocialLinksReady(),
        progress: this.busyAction() === 'save-social-links'
          ? { state: 'loading', durationMs: 3000 }
          : null,
        context: { action: 'save-social-links' }
      }
    ];
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
    const configuration = this.workspace.configuration();
    const locallyTested = Boolean(
      this.workspace.configurationAuthenticationTest()?.success
      && this.workspace.configurationMessagingTest()?.success
    );
    const publicClientReady = Boolean(
      draft?.firebase.apiKey.trim()
      && draft.firebase.authDomain.trim()
      && draft.firebase.projectId.trim()
      && draft.firebase.messagingSenderId.trim()
      && draft.firebase.appId.trim()
      && draft.firebase.vapidKey.trim()
    );
    return [
      {
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
      },
      {
        id: 'operator-activate-firebase',
        label: configuration?.firebase.active
          ? 'operator.configuration.firebase.active'
          : 'operator.configuration.firebase.activate',
        icon: configuration?.firebase.active
          ? 'verified'
          : 'published_with_changes',
        palette: 'green',
        layout: 'action',
        disabled: this.configurationDisabled()
          || Boolean(configuration?.firebase.active)
          || this.workspace.configurationFirebaseDirty()
          || !publicClientReady
          || !(
            configuration?.firebase.readyToActivate
            || locallyTested
          ),
        progress: this.busyAction() === 'activate-firebase'
          ? { state: 'loading', durationMs: 3000 }
          : null,
        context: { action: 'activate-firebase' }
      }
    ];
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
          || this.workspace.configurationFirebaseDirty()
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
          || Boolean(configuration?.firebase.active)
          || this.workspace.configurationFirebaseDirty()
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
    effect(onCleanup => {
      if (this.kind() === 'configuration') {
        onCleanup(() => this.scrubConfigurationCredentialDrafts());
      }
    });
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
      if (kind === 'claim') {
        this.claimPath.set('company');
      }
      this.workspace.clearFeedback();
      void this.load(kind);
    });
  }

  protected popupModel(): PopupModel {
    const kind = this.kind();
    const deploymentEntry = kind === 'deployments'
      ? this.menu.selectedLeaderboardEntry()
      : null;
    const deploymentTitle = deploymentEntry
      ? this.i18n.translate(deploymentEntry.label)
      : this.i18n.translate('operator.leaderboard.deployments.title');
    const wide =
      kind === 'claim'
      || kind === 'configuration'
      || kind === 'revenue'
      || kind === 'community'
      || kind === 'deployments';
    return {
      headerLabel: kind === 'deployments'
        ? 'operator.leaderboard.deployments.title'
        : null,
      headerLabelIcon: kind === 'deployments' ? 'hub' : null,
      title: kind === 'deployments'
        ? deploymentTitle
        : this.titleKey(kind),
      subtitle: this.subtitleKey(kind),
      ariaLabel: kind === 'deployments'
        ? [
            this.i18n.translate(
              'operator.leaderboard.deployments.title'
            ),
            deploymentTitle
          ].join(': ')
        : this.titleKey(kind),
      translateTitle: kind !== 'deployments',
      closeAriaLabel: 'operator.popup.close',
      size: wide ? 'wide' : 'small',
      height: wide ? 'full' : 'auto',
      mobilePresentation: wide ? 'fullscreen' : 'compact',
      headerTone: 'accent',
      headerPalette: this.headerPalette(kind),
      bodyLayout: kind === 'deployments' ? 'fill' : 'default',
      headerActions: kind === 'claim' && this.canIssueClientCode()
        ? [{
            id: 'operator-claim-client-code',
            icon: 'key',
            label: 'operator.claim.client.code',
            palette: 'teal',
            disabled: this.busy()
          }]
        : [],
      onAction: event => {
        void this.onPopupHeaderAction(event);
      },
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
      case 'claim-share':
        await this.workspace.claimShare();
        return;
      case 'redeem-token':
        await this.workspace.linkOperatorGroup();
        return;
      case 'set-claim-path':
        if (context.claimPath) {
          this.claimPath.set(context.claimPath);
          this.workspace.clearFeedback();
        }
        return;
      case 'save-branding':
        await this.workspace.saveConfiguration(
          'save-branding',
          'operator.configuration.branding.saved'
        );
        return;
      case 'save-admin-emails':
        await this.workspace.saveConfiguration(
          'save-admin-emails',
          'operator.configuration.admin.saved'
        );
        return;
      case 'save-privacy-contact':
        await this.workspace.saveConfiguration(
          'save-privacy-contact',
          'operator.configuration.privacy.contact.saved'
        );
        return;
      case 'add-social-link':
        this.workspace.addConfigurationSocialLink();
        return;
      case 'remove-social-link':
        if (context.socialLinkIndex !== undefined) {
          this.workspace.removeConfigurationSocialLink(
            context.socialLinkIndex
          );
        }
        return;
      case 'save-social-links':
        await this.workspace.saveConfiguration(
          'save-social-links',
          'operator.configuration.social.saved'
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
      case 'activate-firebase':
        await this.workspace.activateFirebase();
        return;
      case 'test-authentication':
        await this.workspace.testConfiguration('FIREBASE_AUTHENTICATION');
        return;
      case 'test-messaging':
        await this.workspace.testConfiguration('FIREBASE_MESSAGING');
        return;
      case 'synchronize-revenue':
        await this.workspace.synchronizeRevenue();
        return;
      case 'requeue-revenue-report': {
        const reportId = context.reportId?.trim() ?? '';
        if (!reportId) {
          return;
        }
        this.requeueingReportId.set(reportId);
        try {
          const result = await this.workspace.requeueRevenueReport(reportId);
          if (result?.status === 'PENDING') {
            this.revenueReportsSmartListRef()?.removeVisibleItemByIdentity(
              reportId,
              { totalDelta: -1 }
            );
          }
        } finally {
          this.requeueingReportId.set(null);
        }
        return;
      }
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

  private scrubConfigurationCredentialDrafts(): void {
    this.workspace.clearConfigurationCredentialDrafts();
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

  protected leaderboardDeploymentRow(
    deployment: OperatorLeaderboardDeploymentDto
  ): SingleRowData<OperatorLeaderboardDeploymentDto> {
    const locale = this.i18n.currentLanguage();
    const units = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0
    }).format(Math.max(0, deployment.verifiedWeight));
    const share = this.formatShare(deployment.sharePercent);
    const membershipLabel = this.i18n.translate(
      `operator.leaderboard.deployments.membership.${
        deployment.membershipState
      }`
    );
    const claimLabel = this.i18n.translate(
      `operator.leaderboard.deployments.claim.${deployment.claimState}`
    );
    const pendingReview = deployment.claimState === 'pending-review';
    const rejectedReview = deployment.claimState === 'rejected';
    return {
      id: deployment.deploymentId,
      title: deployment.deploymentId,
      subtitle: membershipLabel,
      detail: [
        units,
        this.i18n.translate(
          'operator.leaderboard.contribution.units'
        )
      ].join(' '),
      metaRows: pendingReview || rejectedReview ? [] : [claimLabel],
      icon: deployment.membershipState === 'owner'
        ? 'verified_user'
        : 'link',
      surfaceTone: rejectedReview
        ? 'danger'
        : pendingReview
          ? 'warning'
          : deployment.membershipState === 'owner'
            ? 'accent'
            : 'success',
      toneClass: [
        'operator-leaderboard-deployment-row',
        `operator-leaderboard-deployment-row--${
          deployment.membershipState
        }`,
        pendingReview
          ? 'operator-leaderboard-deployment-row--pending-review'
          : '',
        rejectedReview
          ? 'operator-leaderboard-deployment-row--rejected'
          : ''
      ].filter(Boolean).join(' '),
      badges: rejectedReview
        ? [{
            label: claimLabel,
            icon: 'block',
            ariaLabel: claimLabel,
            title: claimLabel,
            tone: 'danger',
            position: 'top-right'
          }]
        : pendingReview
          ? [{
              label: claimLabel,
              icon: 'pending_actions',
              ariaLabel: claimLabel,
              title: claimLabel,
              tone: 'warning',
              position: 'top-right'
            }]
          : [{
              label: `${share}%`,
              icon: 'pie_chart',
              ariaLabel: [
                `${share}%`,
                this.i18n.translate('operator.leaderboard.share')
              ].join(' '),
              title: [
                `${share}%`,
                this.i18n.translate('operator.leaderboard.share')
              ].join(' '),
              tone: deployment.sharePercent > 0 ? 'accent' : 'muted',
              position: 'top-right'
            }],
      eagerDetail: structuredClone(deployment)
    };
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

  protected revenueSyncStateLabel(state: OperatorRevenueSyncState): string {
    return `operator.revenue.delivery.state.${state.toLowerCase()}`;
  }

  protected revenueSyncStateIcon(state: OperatorRevenueSyncState): string {
    switch (state) {
      case 'SYNCHRONIZED':
        return 'check_circle';
      case 'PENDING':
      case 'BUSY':
        return 'schedule';
      case 'BLOCKED':
        return 'report_problem';
      case 'ERROR':
        return 'error_outline';
      case 'DORMANT':
      default:
        return 'pause_circle';
    }
  }

  protected revenueReportActionItems(
    report: OperatorRevenueReportDto
  ): readonly AppMenuItem<string, OperatorPopupActionContext>[] {
    const requeueing = this.requeueingReportId() === report.id;
    return [{
      id: `operator-requeue-revenue-report-${report.id}`,
      label: 'operator.revenue.delivery.report.requeue',
      detail: 'operator.revenue.delivery.report.requeue.detail',
      icon: 'replay',
      palette: 'orange',
      layout: 'action',
      disabled: this.busy() || report.status !== 'BLOCKED',
      progress: requeueing
        ? { state: 'loading', durationMs: 3000 }
        : null,
      context: {
        action: 'requeue-revenue-report',
        reportId: report.id
      }
    }];
  }

  protected formatRevenueReportPeriod(value: string): string {
    const source = `${value ?? ''}`.trim();
    const timestamp = Date.parse(
      /^\d{4}-\d{2}-\d{2}$/.test(source)
        ? `${source}T00:00:00.000Z`
        : source
    );
    if (!Number.isFinite(timestamp)) {
      return source || '—';
    }
    return new Intl.DateTimeFormat(this.i18n.currentLanguage(), {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(timestamp));
  }

  protected revenueReportCurrencies(
    report: OperatorRevenueReportDto
  ): string {
    return [...new Set(
      report.currencies
        .map(currency => currency.currencyCode.trim().toUpperCase())
        .filter(Boolean)
    )].join(', ') || '—';
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

  protected onBrandingLogoCharacterIndexChange(
    value: number | string | null
  ): void {
    if (value === null || `${value}`.trim() === '') {
      this.workspace.setConfigurationBranding({ logoCharacterIndex: null });
      return;
    }
    this.workspace.setConfigurationBranding({
      logoCharacterIndex: Number(value)
    });
  }

  protected onConfigurationAdminEmailsChange(value: unknown): void {
    if (!value || typeof value !== 'object') {
      this.workspace.setConfigurationAdminEmailsInput('');
      return;
    }
    const adminEmailsText = (value as {
      adminEmailsText?: unknown;
    }).adminEmailsText;
    this.workspace.setConfigurationAdminEmailsInput(
      `${adminEmailsText ?? ''}`
    );
  }

  protected onConfigurationPrivacyContactChange(value: unknown): void {
    if (!value || typeof value !== 'object') {
      this.workspace.setConfigurationPrivacyContact({
        dataControllerName: '',
        privacyContactEmail: ''
      });
      return;
    }
    const source = value as {
      dataControllerName?: unknown;
      privacyContactEmail?: unknown;
    };
    this.workspace.setConfigurationPrivacyContact({
      dataControllerName: `${source.dataControllerName ?? ''}`,
      privacyContactEmail: `${source.privacyContactEmail ?? ''}`
    });
  }

  protected socialLinkUrlConfig(): LinkInputConfig {
    return {
      label: this.i18n.translate('operator.configuration.social.url'),
      placeholder: 'https://',
      required: true,
      maxLength: 2048,
      panelMode: 'anchored',
      pasteAriaLabel: this.i18n.translate(
        'operator.configuration.social.url.paste.aria'
      ),
      openAriaLabel: this.i18n.translate(
        'operator.configuration.social.url.open.aria'
      ),
      deleteAriaLabel: this.i18n.translate(
        'operator.configuration.social.url.clear.aria'
      )
    };
  }

  protected setConfigurationSocialLink(
    index: number,
    patch: Partial<DeploymentSocialLinkDto>
  ): void {
    this.workspace.setConfigurationSocialLink(index, patch);
  }

  protected configurationSocialLinkRemoveItems(
    index: number
  ): readonly AppMenuItem<string, OperatorPopupActionContext>[] {
    return [{
      id: `operator-remove-social-link-${index}`,
      label: 'operator.configuration.social.remove',
      icon: 'delete_outline',
      palette: 'red',
      layout: 'action',
      disabled: this.configurationDisabled(),
      context: {
        action: 'remove-social-link',
        socialLinkIndex: index
      }
    }];
  }

  protected brandingLogoCharacterIndexInvalid(): boolean {
    const branding = this.workspace.configurationDraft()?.branding;
    if (!branding || branding.logoCharacterIndex === null) {
      return false;
    }
    const index = branding.logoCharacterIndex;
    return !Number.isInteger(index)
      || index < 0
      || index >= Array.from(branding.productName.trim()).length;
  }

  protected onClaimDraftChange(value: OperatorClaimRequestDto): void {
    this.workspace.setClaimDraft(value);
  }

  protected onClaimClientCodeChange(value: unknown): void {
    if (!value || typeof value !== 'object') {
      this.workspace.setGroupTokenInput('');
      return;
    }
    const clientToken = (value as { clientToken?: unknown }).clientToken;
    this.workspace.setGroupTokenInput(`${clientToken ?? ''}`);
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

  private validClaimEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private validClaimWebsite(value: string): boolean {
    try {
      const url = new URL(value.trim());
      return (
        (url.protocol === 'https:' || url.protocol === 'http:')
        && !url.username
        && !url.password
      );
    } catch {
      return false;
    }
  }

  protected busyLabel(): string {
    switch (this.busyAction()) {
      case 'issue-grouping-token':
        return 'operator.claim.client.code.issuing';
      case 'claim-share':
        return 'operator.claim.applying';
      case 'link-operator-group':
        return 'operator.claim.client.code.redeeming';
      case 'apply-update':
        return 'operator.update.applying';
      case 'synchronize-revenue':
        return 'operator.revenue.delivery.synchronizing';
      case 'requeue-revenue-report':
        return 'operator.revenue.delivery.report.requeue.progress';
      case 'test-authentication':
      case 'test-messaging':
        return 'operator.configuration.testing';
      case 'save-branding':
      case 'save-admin-emails':
      case 'save-privacy-contact':
      case 'save-social-links':
      case 'register-payment':
      case 'register-firebase':
      case 'activate-firebase':
        return 'operator.configuration.saving';
      case 'set-community':
        return 'operator.community.updating';
      default:
        return 'operator.loading';
    }
  }

  protected registeredForClaim(): boolean {
    const status = this.registry.status();
    return Boolean(status?.enabled && status.lifecycle === 'REGISTERED');
  }

  private canIssueClientCode(): boolean {
    const claim = this.workspace.claimStatus();
    return this.registeredForClaim()
      && Boolean(claim?.claimed && claim.operatorGroupId?.trim())
      && (
        claim?.verificationStatus === 'APPROVED'
        || claim?.verificationStatus === 'VERIFIED'
      );
  }

  private async onPopupHeaderAction(event: PopupActionEvent): Promise<void> {
    if (event.action.id !== 'operator-claim-client-code' || !this.canIssueClientCode()) {
      return;
    }
    const token = await this.workspace.issueGroupingToken();
    if (!token?.clientToken.trim()) {
      return;
    }
    const clientToken = token.clientToken.trim();
    this.dialog.open({
      title: this.i18n.translate('operator.claim.client.code.dialog.title'),
      message: clientToken,
      warningMessage: [
        this.i18n.translate('operator.group.expires'),
        this.formatDate(token.expiresAt)
      ].join(': '),
      confirmLabel: this.i18n.translate('operator.claim.client.code.copy'),
      cancelLabel: this.i18n.translate('close'),
      busyConfirmLabel: this.i18n.translate('operator.claim.client.code.copying'),
      confirmTone: 'accent',
      confirmPalette: 'teal',
      failureMessage: this.i18n.translate(
        'operator.claim.client.code.copy.unavailable'
      ),
      onConfirm: async () => {
        const clipboard = globalThis.navigator?.clipboard;
        if (!clipboard?.writeText) {
          throw new Error(
            this.i18n.translate('operator.claim.client.code.copy.unavailable')
          );
        }
        await clipboard.writeText(clientToken);
      }
    });
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
      case 'revenue':
        await this.workspace.loadRevenue();
        return;
      case 'community':
        await this.workspace.loadCommunityStatus();
        return;
      case 'deployments':
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
        const claim = this.workspace.claimStatus();
        if (!claim) {
          return [];
        }
        if (this.claimPath() === 'company') {
          if (claim.verificationStatus === 'REJECTED') {
            return [{
              id: 'operator-claim-rejected',
              label: 'operator.claim.verification.rejected.action',
              icon: 'block',
              palette: 'red',
              layout: 'action',
              disabled: true,
              context: { action: 'claim-share' }
            }];
          }
          if (claim.verificationStatus === 'PENDING_REVIEW') {
            return [{
              id: 'operator-claim-pending-review',
              label: 'operator.claim.verification.pending.action',
              icon: 'pending_actions',
              palette: 'orange',
              layout: 'action',
              disabled: true,
              context: { action: 'claim-share' }
            }];
          }
          if (claim.claimed) {
            return [];
          }
          return [{
            id: 'operator-claim-share',
            label: 'operator.claim.apply',
            icon: 'verified',
            palette: 'purple',
            layout: 'action',
            disabled: this.busy()
              || !this.registeredForClaim()
              || !this.workspace.claimCompanyReady(),
            progress: this.busyAction() === 'claim-share'
              ? { state: 'loading', durationMs: 3000 }
              : null,
            context: { action: 'claim-share' }
          }];
        }
        return [{
          id: 'operator-redeem-token',
          label: 'operator.claim.apply',
          icon: 'verified',
          palette: 'purple',
          layout: 'action',
          disabled: this.busy()
            || !this.registeredForClaim()
            || !this.workspace.claimClientCodeReady(),
          progress: this.busyAction() === 'link-operator-group'
            ? { state: 'loading', durationMs: 3000 }
            : null,
          context: { action: 'redeem-token' }
        }];
      }
      case 'revenue': {
        const sync = this.workspace.revenueSync();
        return [{
          id: 'operator-synchronize-revenue',
          label: 'operator.revenue.delivery.synchronize',
          detail: sync
            ? this.revenueSyncStateLabel(sync.state)
            : 'operator.revenue.delivery.synchronize.detail',
          icon: sync ? this.revenueSyncStateIcon(sync.state) : 'sync',
          palette: this.revenueSyncPalette(sync?.state),
          layout: 'action',
          disabled: this.busy(),
          progress: this.busyAction() === 'synchronize-revenue'
            ? { state: 'loading', durationMs: 3000 }
            : null,
          context: { action: 'synchronize-revenue' }
        }];
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

  private revenueSyncPalette(
    state: OperatorRevenueSyncState | undefined
  ): 'green' | 'orange' | 'red' | 'slate' {
    switch (state) {
      case 'SYNCHRONIZED':
        return 'green';
      case 'PENDING':
      case 'BUSY':
        return 'orange';
      case 'BLOCKED':
      case 'ERROR':
        return 'red';
      case 'DORMANT':
      default:
        return 'slate';
    }
  }

  private titleKey(kind: OperatorMenuKind | null): string {
    switch (kind) {
      case 'updates':
        return 'operator.action.updates';
      case 'claim':
        return 'operator.action.claim.share';
      case 'configuration':
        return 'operator.action.configuration';
      case 'revenue':
        return 'operator.action.revenue';
      case 'community':
        return 'operator.community';
      case 'deployments':
        return 'operator.leaderboard.deployments.title';
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
      case 'revenue':
        return 'operator.revenue.subtitle';
      case 'community':
        return 'operator.community.subtitle';
      case 'deployments':
        return 'operator.leaderboard.deployments.subtitle';
      default:
        return '';
    }
  }

  private headerPalette(
    kind: OperatorMenuKind | null
  ): 'teal' | 'violet' | 'blue' | 'green' | 'slate' {
    switch (kind) {
      case 'updates':
        return 'teal';
      case 'claim':
        return 'violet';
      case 'configuration':
        return 'blue';
      case 'revenue':
        return 'green';
      case 'deployments':
        return 'teal';
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
