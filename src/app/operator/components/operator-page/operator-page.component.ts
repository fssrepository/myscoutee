import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { USER_BY_ID_LOAD_CONTEXT_KEY } from '../../../shared/core';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type { ListQuery } from '../../../shared/core/contracts/list.interface';
import type {
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardGroup
} from '../../../shared/core/contracts/operator.interface';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui/components/core/menu';
import {
  SingleRowComponent,
  SmartListComponent,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui/components/core/smart-list';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import {
  OperatorLeaderboardStore,
  type OperatorLeaderboardFilters
} from '../../../shared/ui/context/stores/operator-leaderboard.store';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { OperatorLeaderboardSingleRowConverter } from '../../../shared/ui/converters/operator-leaderboard-single-row.converter';
import { I18nPipe } from '../../../shared/ui/pipes';

type OperatorActionId = Exclude<OperatorMenuKind, 'community'>;

@Component({
  selector: 'app-operator-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    IndicatorComponent,
    I18nPipe,
    MatIconModule,
    NgComponentOutlet,
    SingleRowComponent,
    SmartListComponent
  ],
  templateUrl: './operator-page.component.html',
  styleUrl: './operator-page.component.scss'
})
export class OperatorPageComponent implements OnInit {
  protected readonly registry = inject(OperatorRegistryStore);
  protected readonly operatorMenu = inject(OperatorMenuStore);
  protected readonly workspace = inject(OperatorWorkspaceStore);
  protected readonly leaderboard = inject(OperatorLeaderboardStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly i18n = inject(I18nService);
  private readonly profileLoadState = this.runtimeStore.selectLoadingState(
    USER_BY_ID_LOAD_CONTEXT_KEY
  );
  private readonly registrationPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly actionPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly rowConverter = new OperatorLeaderboardSingleRowConverter();

  protected readonly status = this.registry.status;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly registrationPopupComponent = this.registrationPopupComponentRef.asReadonly();
  protected readonly actionPopupComponent = this.actionPopupComponentRef.asReadonly();
  protected readonly activePopup = this.operatorMenu.activePopup;
  protected readonly loading = computed(
    () => this.busyAction() === 'load'
      || this.profileLoadState().status === 'idle'
      || this.profileLoadState().status === 'loading'
      || (!this.status() && !this.errorMessage())
  );
  protected readonly errorMessage = computed(() => {
    const storeError = this.registry.error().trim();
    if (storeError) {
      return storeError;
    }
    const status = this.status();
    return status?.lastError?.message?.trim()
      || (status?.lifecycle === 'ERROR' ? 'operator.registration.status.error' : '');
  });
  protected readonly actionItems = computed<readonly AppMenuItem<OperatorActionId>[]>(() => [
    {
      id: 'updates',
      label: 'operator.action.updates',
      detail: this.workspace.deploymentUpdate()?.updateAvailable
        ? 'operator.action.updates.available'
        : 'operator.action.updates.detail',
      icon: 'system_update_alt',
      palette: 'teal',
      kind: 'action',
      layout: 'big',
      counter: this.workspace.deploymentUpdate()?.updateAvailable ? 1 : null,
      counterTone: 'alert',
      progress: this.workspace.busyAction() === 'load-update'
        || this.workspace.busyAction() === 'apply-update'
        ? { state: 'loading', durationMs: 3000 }
        : null
    },
    {
      id: 'registration',
      label: 'operator.action.node.registration',
      detail: this.status()?.enabled && this.status()?.lifecycle === 'REGISTERED'
        ? 'operator.action.node.registration.registered'
        : 'operator.action.node.registration.detail',
      icon: 'app_registration',
      palette: 'violet',
      kind: 'action',
      layout: 'big',
      progress: this.busyAction() === 'register'
        ? { state: 'loading', durationMs: 3000 }
        : null
    },
    {
      id: 'claim',
      label: 'operator.action.claim.share',
      detail: this.workspace.claimStatus()?.claimed
        ? 'operator.action.claim.share.claimed'
        : 'operator.action.claim.share.detail',
      icon: 'redeem',
      palette: 'purple',
      kind: 'action',
      layout: 'big',
      progress: this.workspace.busyAction() === 'load-claim'
        || this.workspace.busyAction() === 'claim-share'
        || this.workspace.busyAction() === 'issue-grouping-token'
        || this.workspace.busyAction() === 'link-operator-group'
        ? { state: 'loading', durationMs: 3000 }
        : null
    },
    {
      id: 'configuration',
      label: 'operator.action.configuration',
      detail: 'operator.action.configuration.detail',
      icon: 'tune',
      palette: 'blue',
      kind: 'action',
      layout: 'big',
      progress: this.workspace.busyAction() === 'load-configuration'
        || this.workspace.busyAction() === 'save-branding'
        || this.workspace.busyAction() === 'register-payment'
        || this.workspace.busyAction() === 'register-firebase'
        || this.workspace.busyAction() === 'test-authentication'
        || this.workspace.busyAction() === 'test-messaging'
        ? { state: 'loading', durationMs: 3000 }
        : null
    }
  ]);
  protected readonly leaderboardQuery = computed<
    Partial<ListQuery<OperatorLeaderboardFilters>>
  >(() => ({
    page: 0,
    pageSize: 8,
    sort: 'share',
    direction: 'desc',
    filters: { revision: this.leaderboard.revision() }
  }));
  protected readonly leaderboardConfig: SmartListConfig<
    OperatorLeaderboardEntryDto,
    OperatorLeaderboardFilters
  > = {
    pageSize: 8,
    defaultView: 'list',
    defaultSort: 'share',
    defaultDirection: 'desc',
    defaultFilters: { revision: 0 },
    emptyLabel: 'operator.leaderboard.empty',
    emptyDescription: 'operator.leaderboard.empty.description',
    showStickyHeader: false,
    showFirstGroupMarker: true,
    listLayout: 'stack',
    snapMode: 'none',
    preloadOffsetPx: 180,
    headerProgress: {
      enabled: true,
      placement: 'inline',
      tone: 'accent'
    },
    cacheable: {
      identity: item => item.id
    },
    groupBy: item => this.leaderboardGroupTitle(item.group),
    containerClass: {
      'operator-leaderboard-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };
  protected readonly loadLeaderboardPage: SmartListLoadPage<
    OperatorLeaderboardEntryDto,
    OperatorLeaderboardFilters
  > = (query, context) => from(this.leaderboard.queryPage(query, context?.signal));

  constructor() {
    effect(() => {
      const popup = this.activePopup();
      if (popup === 'registration') {
        void this.ensureRegistrationPopupLoaded();
      } else if (popup) {
        void this.ensureActionPopupLoaded();
      }
    });
  }

  ngOnInit(): void {
    void Promise.all([
      this.registry.loadStatus(),
      this.workspace.loadDeploymentUpdate()
    ]);
  }

  protected openAction(event: AppMenuItemSelectEvent<OperatorActionId>): void {
    this.operatorMenu.open(event.id);
  }

  protected leaderboardRow(
    entry: OperatorLeaderboardEntryDto
  ): SingleRowData<OperatorLeaderboardEntryDto> {
    return this.rowConverter.convert({
      ...entry,
      label: this.i18n.translate(entry.label)
    }, {
      locale: this.i18n.currentLanguage(),
      shareLabel: this.i18n.translate('operator.leaderboard.share'),
      unitsLabel: this.i18n.translate('operator.leaderboard.contribution.units'),
      deploymentLabel: this.i18n.translate('operator.leaderboard.deployment'),
      deploymentsLabel: this.i18n.translate('operator.leaderboard.deployments'),
      claimedNodeLabel: this.i18n.translate('operator.leaderboard.claimed.node'),
      unclaimedNodeLabel: this.i18n.translate('operator.leaderboard.unclaimed.node')
    });
  }

  protected leaderboardGroupSummary(group: OperatorLeaderboardGroup): string {
    const summary = this.leaderboard.summaries().find(item => item.group === group);
    const label = this.leaderboardGroupTitle(group);
    if (!summary) {
      return label;
    }
    const weight = new Intl.NumberFormat(this.i18n.currentLanguage(), {
      maximumFractionDigits: 0
    }).format(summary.verifiedWeight);
    const share = new Intl.NumberFormat(this.i18n.currentLanguage(), {
      minimumFractionDigits: summary.sharePercent > 0 && summary.sharePercent < 1 ? 2 : 1,
      maximumFractionDigits: 2
    }).format(summary.sharePercent);
    return `${label} · ${weight} ${this.i18n.translate('operator.leaderboard.contribution.units')} · ${share}%`;
  }

  private leaderboardGroupTitle(group: OperatorLeaderboardGroup): string {
    const labelKey = group === 'FOUNDER'
      ? 'operator.leaderboard.group.founder'
      : group === 'CLAIMED'
        ? 'operator.leaderboard.group.claimed.nodes'
        : 'operator.leaderboard.group.unclaimed.nodes';
    return this.i18n.translate(labelKey);
  }

  private async ensureRegistrationPopupLoaded(): Promise<void> {
    if (this.registrationPopupComponentRef()) {
      return;
    }
    const module = await import('../operator-registry-popup/operator-registry-popup.component');
    this.registrationPopupComponentRef.set(module.OperatorRegistryPopupComponent);
  }

  private async ensureActionPopupLoaded(): Promise<void> {
    if (this.actionPopupComponentRef()) {
      return;
    }
    const module = await import('../operator-action-popup/operator-action-popup.component');
    this.actionPopupComponentRef.set(module.OperatorActionPopupComponent);
  }
}
