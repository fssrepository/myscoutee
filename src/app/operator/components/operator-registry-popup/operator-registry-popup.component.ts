import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryBaseUrl
} from '../../../shared/core/base/operator-registry-candidate';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type {
  ListQuery,
  OperatorMeasurementReportDto,
  OperatorMeasurementReportFilters,
  OperatorMeasurementSyncState
} from '../../../shared/core/contracts';
import {
  LinkInputComponent,
  type LinkInputConfig
} from '../../../shared/ui/components/core/form/inputs/link-input';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui/components/core/menu';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  SmartListComponent,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui/components/core/smart-list';
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { I18nPipe } from '../../../shared/ui/pipes';

@Component({
  selector: 'app-operator-registry-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppMenuComponent,
    IndicatorComponent,
    I18nPipe,
    LinkInputComponent,
    MatIconModule,
    PopupComponent,
    SmartListComponent
  ],
  templateUrl: './operator-registry-popup.component.html',
  styleUrl: './operator-registry-popup.component.scss'
})
export class OperatorRegistryPopupComponent implements OnInit {
  protected readonly registry = inject(OperatorRegistryStore);
  protected readonly operatorMenu = inject(OperatorMenuStore);
  private readonly workspace = inject(OperatorWorkspaceStore);
  private readonly i18n = inject(I18nService);
  protected readonly status = this.registry.status;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly errorMessage = this.registry.error;
  protected readonly noticeMessage = this.registry.notice;
  protected readonly registryBaseUrl = this.registry.registryBaseUrl;
  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly loading = computed(() => this.busyAction() === 'load');
  protected readonly canRegister = this.registry.canRegister;
  protected readonly requeueingMeasurementReportId = signal<string | null>(null);
  private readonly measurementReportsSmartListRef = signal<
    SmartListComponent<
      OperatorMeasurementReportDto,
      OperatorMeasurementReportFilters
    > | null
  >(null);

  @ViewChild('measurementReportsSmartList')
  protected set measurementReportsSmartList(
    value: SmartListComponent<
      OperatorMeasurementReportDto,
      OperatorMeasurementReportFilters
    > | undefined
  ) {
    this.measurementReportsSmartListRef.set(value ?? null);
  }

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
      panelMode: 'auto',
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
  protected readonly registryActionItems = computed<readonly AppMenuItem<string>[]>(() => [
    {
      id: 'disconnect',
      label: 'operator.registration.disable',
      icon: 'link_off',
      layout: 'action',
      palette: 'danger',
      disabled: this.busy() || !this.registered(),
      progress: this.busyAction() === 'disconnect'
        ? { state: 'loading', shape: 'button', durationMs: 3000 }
        : null
    },
    {
      id: 'register',
      label: 'operator.registration.register',
      icon: 'app_registration',
      layout: 'action',
      palette: 'violet',
      disabled: !this.canRegister(),
      progress: this.busyAction() === 'register'
        ? { state: 'loading', shape: 'button', durationMs: 3000 }
        : null
    }
  ]);
  protected readonly measurementSyncActionItems =
    computed<readonly AppMenuItem<string>[]>(() => {
      const synchronization = this.registry.measurementSync();
      return [{
        id: 'synchronize-measurements',
        label: 'operator.measurements.delivery.synchronize',
        detail: synchronization
          ? this.measurementStateLabel(synchronization.state)
          : 'operator.measurements.delivery.synchronize.detail',
        icon: synchronization
          ? this.measurementStateIcon(synchronization.state)
          : 'sync',
        layout: 'action',
        palette: this.measurementStatePalette(synchronization?.state),
        disabled: this.busy() || !this.registered(),
        progress: this.busyAction() === 'synchronize-measurements'
          ? { state: 'loading', shape: 'button', durationMs: 3000 }
          : null
      }];
    });
  protected readonly measurementReportQuery = computed<
    Partial<ListQuery<OperatorMeasurementReportFilters>>
  >(() => ({
    page: 0,
    pageSize: 4,
    sort: 'period',
    direction: 'desc',
    filters: {
      status: 'BLOCKED',
      revision: this.registry.measurementSync()?.synchronizedAt ?? ''
    }
  }));
  protected readonly measurementReportConfig: SmartListConfig<
    OperatorMeasurementReportDto,
    OperatorMeasurementReportFilters
  > = {
    pageSize: 4,
    initialPageSize: 4,
    defaultView: 'list',
    emptyLabel: 'operator.measurements.reports.empty',
    emptyDescription: 'operator.measurements.reports.empty.description',
    showStickyHeader: false,
    showFirstGroupMarker: false,
    listLayout: 'stack',
    snapMode: 'none',
    preloadOffsetPx: 100,
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
  protected readonly loadMeasurementReportPage: SmartListLoadPage<
    OperatorMeasurementReportDto,
    OperatorMeasurementReportFilters
  > = (query, context) => from(
    this.registry.measurementReportPage(query, context?.signal)
  );

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
      bodyLayout: 'overflow',
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
    this.registry.setExpectedRegistryScope(selectedOption?.registryScope?.trim() ?? '');
  }

  protected async registerNode(): Promise<void> {
    const currentRegistryScope = (
      this.status()?.selection?.registryScope
      ?? this.status()?.selection?.registryIdentity?.registryScope
      ?? ''
    ).trim();
    const targetRegistryScope = this.registry.expectedRegistryScope().trim();
    const replacingActiveBinding = this.registered()
      && Boolean(this.currentRegistryUrl())
      && (
        !this.sameUrl(this.currentRegistryUrl(), this.registryBaseUrl())
        || Boolean(
          currentRegistryScope
          && targetRegistryScope
          && currentRegistryScope !== targetRegistryScope
        )
      );
    const requireHttps = this.status()?.mode === 'REAL';
    const baseUrlError = validateOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      requireHttps
    );
    if (baseUrlError) {
      this.registry.setError(baseUrlError);
      return;
    }
    this.registry.setRegistryBaseUrl(normalizeOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      requireHttps
    ));
    this.registry.clearFeedback();
    const status = await this.registry.register();
    if (
      replacingActiveBinding
      && (Boolean(status) || !this.registered())
    ) {
      this.workspace.applyRegistryDeactivation();
    }
    if (status) {
      this.registry.setNotice('operator.registration.completed');
    }
  }

  protected async disconnect(): Promise<void> {
    this.registry.clearFeedback();
    const status = await this.registry.disconnect();
    if (status) {
      this.workspace.applyRegistryDeactivation();
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

  protected onRegistryActionSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id === 'disconnect') {
      void this.disconnect();
    } else if (event.id === 'register') {
      void this.registerNode();
    }
  }

  protected onMeasurementSyncActionSelect(
    event: AppMenuItemSelectEvent<string>
  ): void {
    if (event.id === 'synchronize-measurements') {
      void this.registry.synchronizeMeasurements();
    }
  }

  protected measurementReportActionItems(
    report: OperatorMeasurementReportDto
  ): readonly AppMenuItem<string, { reportId: string }>[] {
    const requeueing = this.requeueingMeasurementReportId() === report.id;
    return [{
      id: `operator-requeue-measurement-report-${report.id}`,
      label: 'operator.measurements.report.requeue',
      detail: 'operator.measurements.report.requeue.detail',
      icon: 'replay',
      palette: 'orange',
      layout: 'action',
      disabled: this.busy() || report.status !== 'BLOCKED',
      progress: requeueing
        ? { state: 'loading', shape: 'button', durationMs: 3000 }
        : null,
      context: { reportId: report.id }
    }];
  }

  protected async onMeasurementReportActionSelect(
    event: AppMenuItemSelectEvent<string, { reportId: string }>
  ): Promise<void> {
    const reportId = event.context?.reportId?.trim() ?? '';
    if (!reportId) {
      return;
    }
    this.requeueingMeasurementReportId.set(reportId);
    try {
      const result = await this.registry.requeueMeasurementReport(reportId);
      if (result?.status === 'PENDING') {
        this.measurementReportsSmartListRef()?.removeVisibleItemByIdentity(
          reportId,
          { totalDelta: -1 }
        );
      }
    } finally {
      this.requeueingMeasurementReportId.set(null);
    }
  }

  protected measurementStateLabel(
    state: OperatorMeasurementSyncState
  ): string {
    return `operator.measurements.delivery.state.${state.toLowerCase()}`;
  }

  protected measurementStateIcon(state: OperatorMeasurementSyncState): string {
    switch (state) {
      case 'READY':
        return 'check_circle';
      case 'BLOCKED':
        return 'report_problem';
      case 'BUSY':
        return 'schedule';
      case 'ERROR':
        return 'error_outline';
      case 'DORMANT':
      default:
        return 'pause_circle';
    }
  }

  protected formatMeasurementPeriod(value: string): string {
    const source = `${value ?? ''}`.trim();
    const monthOnly = /^\d{4}-\d{2}$/.test(source);
    const timestamp = Date.parse(
      /^\d{4}-\d{2}-\d{2}$/.test(source) || monthOnly
        ? `${source}${monthOnly ? '-01' : ''}T00:00:00.000Z`
        : source
    );
    if (!Number.isFinite(timestamp)) {
      return source || '—';
    }
    return new Intl.DateTimeFormat(
      this.i18n.currentLanguage(),
      monthOnly
        ? {
            year: 'numeric',
            month: 'short',
            timeZone: 'UTC'
          }
        : {
            dateStyle: 'medium',
            timeZone: 'UTC'
          }
    ).format(new Date(timestamp));
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

  private measurementStatePalette(
    state: OperatorMeasurementSyncState | undefined
  ): 'green' | 'orange' | 'red' | 'slate' {
    switch (state) {
      case 'READY':
        return 'green';
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
}
