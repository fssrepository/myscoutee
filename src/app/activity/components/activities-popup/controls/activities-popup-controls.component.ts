import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA, type RateFilterEntry } from '../../../../shared/app-static-data';
import type * as ContractTypes from '../../../../shared/core/contracts';
import {
  AppMenuComponent,
  I18nPipe,
  type AppMenuGroup,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../../shared/ui';

type ActivitiesPopupControlsMode = 'header' | 'toolbar';

type ActivitiesPopupControlsMenuContext =
  | { menu: 'primary'; value: ContractTypes.ActivitiesPrimaryFilter }
  | { menu: 'event-scope'; value: ContractTypes.ActivitiesEventScope }
  | { menu: 'chat-context'; value: ContractTypes.ActivitiesChatContextFilter }
  | { menu: 'rate'; value: ContractTypes.RateFilterKey }
  | { menu: 'rate-social'; value: string }
  | { menu: 'secondary'; value: ContractTypes.ActivitiesSecondaryFilter }
  | { menu: 'view'; value: ContractTypes.ActivitiesView }
  | { menu: 'support-case'; value: ContractTypes.SupportCaseFilter }
  | { menu: 'quick-action'; value: 'explore' | 'create' };

export interface ActivitiesPopupControlsModel {
  primaryFilter: ContractTypes.ActivitiesPrimaryFilter;
  eventScope: ContractTypes.ActivitiesEventScope;
  chatContextFilter: ContractTypes.ActivitiesChatContextFilter;
  supportCaseFilter: ContractTypes.SupportCaseFilter;
  secondaryFilter: ContractTypes.ActivitiesSecondaryFilter;
  rateFilter: ContractTypes.RateFilterKey;
  view: ContractTypes.ActivitiesView;
  isMobileView: boolean;
  adminServiceMode: boolean;
  calendarLayout: boolean;
  ratesFullscreenActive: boolean;
  showRatesFullscreenToggle: boolean;
  individualRateSocialBadgeEnabled: boolean;
  pairRateSocialBadgeEnabled: boolean;
  primaryCounts: Partial<Record<ContractTypes.ActivitiesPrimaryFilter, number>>;
  eventScopeCounts: Partial<Record<ContractTypes.ActivitiesEventScope, number>>;
  chatContextCounts: Partial<Record<ContractTypes.ActivitiesChatContextFilter, number>>;
  supportCaseCounts: Partial<Record<ContractTypes.SupportCaseFilter, number>>;
  rateFilterCounts: Partial<Record<ContractTypes.RateFilterKey, number>>;
}

export type ActivitiesPopupControlsAction =
  | { type: 'close' }
  | { type: 'primaryFilter'; value: ContractTypes.ActivitiesPrimaryFilter }
  | { type: 'eventScope'; value: ContractTypes.ActivitiesEventScope }
  | { type: 'chatContextFilter'; value: ContractTypes.ActivitiesChatContextFilter }
  | { type: 'rateFilter'; value: ContractTypes.RateFilterKey }
  | { type: 'rateSocialBadgeGroup'; value: string }
  | { type: 'secondaryFilter'; value: ContractTypes.ActivitiesSecondaryFilter }
  | { type: 'view'; value: ContractTypes.ActivitiesView; sourceEvent?: Event }
  | { type: 'supportCaseFilter'; value: ContractTypes.SupportCaseFilter }
  | { type: 'eventExplore' }
  | { type: 'eventEditor' }
  | { type: 'ratesFullscreenToggle'; sourceEvent: Event };

const DEFAULT_CONTROLS_MODEL: ActivitiesPopupControlsModel = {
  primaryFilter: 'chats',
  eventScope: 'active-events',
  chatContextFilter: 'all',
  supportCaseFilter: 'all',
  secondaryFilter: 'recent',
  rateFilter: 'individual-given',
  view: 'day',
  isMobileView: false,
  adminServiceMode: false,
  calendarLayout: false,
  ratesFullscreenActive: false,
  showRatesFullscreenToggle: false,
  individualRateSocialBadgeEnabled: false,
  pairRateSocialBadgeEnabled: false,
  primaryCounts: {},
  eventScopeCounts: {},
  chatContextCounts: {},
  supportCaseCounts: {},
  rateFilterCounts: {}
};

@Component({
  selector: 'app-activities-popup-controls',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent, I18nPipe],
  templateUrl: './activities-popup-controls.component.html',
  styleUrl: './activities-popup-controls.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesPopupControlsComponent {
  @Input() mode: ActivitiesPopupControlsMode = 'toolbar';
  @Input() model: ActivitiesPopupControlsModel | null = null;

  @Output() action = new EventEmitter<ActivitiesPopupControlsAction>();

  protected readonly activitiesPrimaryFilters: Array<{ key: ContractTypes.ActivitiesPrimaryFilter; label: string; icon: string }> = [
    { key: 'rates', label: 'Rates', icon: 'star' },
    { key: 'chats', label: 'Chats', icon: 'chat' },
    { key: 'events', label: 'Events', icon: 'event' }
  ];
  protected readonly activitiesEventScopeFilters: ReadonlyArray<{ key: ContractTypes.ActivitiesEventScope; label: string; icon: string }> = [
    { key: 'all', label: 'All', icon: 'widgets' },
    { key: 'active-events', label: 'Active Events', icon: 'event' },
    { key: 'pending', label: 'Pending', icon: 'pending_actions' },
    { key: 'invitations', label: 'Invitations', icon: 'mail' },
    { key: 'my-events', label: 'My Events', icon: 'stadium' },
    { key: 'drafts', label: 'Drafts', icon: 'drafts' },
    { key: 'trash', label: 'Trash', icon: 'delete' }
  ];
  protected readonly activitiesSecondaryFilters: Array<{ key: ContractTypes.ActivitiesSecondaryFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesSecondaryFilters];
  protected readonly activitiesChatContextFilters: Array<{ key: ContractTypes.ActivitiesChatContextFilter; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesChatContextFilters];
  protected readonly activitiesSupportCaseFilters: Array<{ key: ContractTypes.SupportCaseFilter; labelKey: string; icon: string }> = [
    { key: 'all', labelKey: 'activities.support.case.filter.all', icon: 'list' },
    { key: 'pending', labelKey: 'activities.support.case.filter.pending', icon: 'pending_actions' },
    { key: 'picked', labelKey: 'activities.support.case.filter.picked', icon: 'assignment_ind' },
    { key: 'solved', labelKey: 'activities.support.case.filter.solved', icon: 'check_circle' },
    { key: 'blocked', labelKey: 'activities.support.case.filter.blocked', icon: 'block' }
  ];
  protected readonly rateFilters: Array<{ key: ContractTypes.RateFilterKey; label: string }>
    = [...APP_STATIC_DATA.rateFilters];
  protected readonly rateFilterEntries: RateFilterEntry[]
    = [...APP_STATIC_DATA.rateFilterEntries];
  protected readonly activitiesViewOptions: Array<{ key: ContractTypes.ActivitiesView; label: string; icon: string }>
    = [...APP_STATIC_DATA.activitiesViewOptions];

  protected get primaryFilter(): ContractTypes.ActivitiesPrimaryFilter {
    return this.controlsModel.primaryFilter;
  }

  protected get eventScope(): ContractTypes.ActivitiesEventScope {
    return this.controlsModel.eventScope;
  }

  protected get chatContextFilter(): ContractTypes.ActivitiesChatContextFilter {
    return this.controlsModel.chatContextFilter;
  }

  protected get supportCaseFilter(): ContractTypes.SupportCaseFilter {
    return this.controlsModel.supportCaseFilter;
  }

  protected get secondaryFilter(): ContractTypes.ActivitiesSecondaryFilter {
    return this.controlsModel.secondaryFilter;
  }

  protected get rateFilter(): ContractTypes.RateFilterKey {
    return this.controlsModel.rateFilter;
  }

  protected get view(): ContractTypes.ActivitiesView {
    return this.controlsModel.view;
  }

  protected get isMobileView(): boolean {
    return this.controlsModel.isMobileView;
  }

  protected get adminServiceMode(): boolean {
    return this.controlsModel.adminServiceMode;
  }

  protected get calendarLayout(): boolean {
    return this.controlsModel.calendarLayout;
  }

  protected get ratesFullscreenActive(): boolean {
    return this.controlsModel.ratesFullscreenActive;
  }

  protected get showRatesFullscreenToggle(): boolean {
    return this.controlsModel.showRatesFullscreenToggle;
  }

  private get individualRateSocialBadgeEnabled(): boolean {
    return this.controlsModel.individualRateSocialBadgeEnabled;
  }

  private get pairRateSocialBadgeEnabled(): boolean {
    return this.controlsModel.pairRateSocialBadgeEnabled;
  }

  private get primaryCounts(): Partial<Record<ContractTypes.ActivitiesPrimaryFilter, number>> {
    return this.controlsModel.primaryCounts;
  }

  private get eventScopeCounts(): Partial<Record<ContractTypes.ActivitiesEventScope, number>> {
    return this.controlsModel.eventScopeCounts;
  }

  private get chatContextCounts(): Partial<Record<ContractTypes.ActivitiesChatContextFilter, number>> {
    return this.controlsModel.chatContextCounts;
  }

  private get supportCaseCounts(): Partial<Record<ContractTypes.SupportCaseFilter, number>> {
    return this.controlsModel.supportCaseCounts;
  }

  private get rateFilterCounts(): Partial<Record<ContractTypes.RateFilterKey, number>> {
    return this.controlsModel.rateFilterCounts;
  }

  private get controlsModel(): ActivitiesPopupControlsModel {
    return this.model ?? DEFAULT_CONTROLS_MODEL;
  }

  protected isEventActivitiesPrimaryFilter(): boolean {
    return this.primaryFilter === 'events';
  }

  protected isRateFilterVisible(): boolean {
    return this.primaryFilter === 'rates';
  }

  protected shouldShowActivitiesQuickActions(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && this.eventScope !== 'all'
      && this.eventScope !== 'active-events'
      && this.eventScope !== 'pending'
      && this.eventScope !== 'invitations'
      && this.eventScope !== 'trash';
  }

  protected shouldShowStandaloneEventExploreAction(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && (this.eventScope === 'all' || this.eventScope === 'active-events');
  }

  protected activitiesHeaderLineOne(): string {
    if (this.primaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    if (this.primaryFilter === 'rates') {
      const group = this.rateGroupLabelKeyForKey(this.rateFilter);
      const label = this.rateFilterLabelForKey(this.rateFilter);
      return `${group} · ${label}`;
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      if (this.view === 'month' || this.view === 'week') {
        return `Events · ${this.activitiesEventScopeLabel()}`;
      }
      return this.activitiesEventScopeLabel();
    }
    if (this.view === 'month' || this.view === 'week') {
      return this.activitiesPrimaryFilterLabel();
    }
    return `${this.activitiesPrimaryFilterLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
  }

  protected activitiesHeaderLineTwo(): string {
    return '';
  }

  protected activitiesSupportCaseMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.supportCaseFilterLabelKey(),
      icon: this.supportCaseFilterIcon(),
      palette: this.supportCasePalette(this.supportCaseFilter),
      counter: this.supportCaseFilterCount(),
      layout: 'pill'
    });
  }

  protected activitiesSupportCaseMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.activitiesSupportCaseFilters.map(option => this.activitiesMenuItem({
      id: `support-case:${option.key}`,
      label: option.labelKey,
      icon: option.icon,
      palette: this.supportCasePalette(option.key),
      counter: this.supportCaseFilterCount(option.key),
      active: option.key === this.supportCaseFilter,
      context: { menu: 'support-case', value: option.key }
    }));
  }

  protected activitiesPrimaryMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesPrimaryFilterLabel(),
      icon: this.activitiesPrimaryFilterIcon(),
      palette: this.activitiesPrimaryPalette(this.primaryFilter),
      counter: this.activitiesPrimaryFilterCount(this.primaryFilter)
    });
  }

  protected activitiesPrimaryMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.activitiesPrimaryFilters.map(option => this.activitiesMenuItem({
      id: `primary:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesPrimaryPalette(option.key),
      counter: this.activitiesPrimaryFilterCount(option.key),
      active: option.key === this.primaryFilter,
      context: { menu: 'primary', value: option.key }
    }));
  }

  protected activitiesEventScopeMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesEventScopeLabel(),
      icon: this.activitiesEventScopeIcon(),
      palette: this.activitiesEventScopePalette(this.eventScope),
      counter: this.activitiesEventScopeCount()
    });
  }

  protected activitiesEventScopeMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.activitiesEventScopeFilters.map(option => this.activitiesMenuItem({
      id: `event-scope:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesEventScopePalette(option.key),
      counter: this.activitiesEventScopeCount(option.key),
      active: option.key === this.eventScope,
      context: { menu: 'event-scope', value: option.key }
    }));
  }

  protected activitiesChatContextMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesChatContextFilterLabel(),
      icon: this.activitiesChatContextFilterIcon(),
      palette: this.activitiesChatContextPalette(this.chatContextFilter),
      counter: this.activitiesChatContextFilterCount(this.chatContextFilter)
    });
  }

  protected activitiesChatContextMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.activitiesChatContextFilters.map(option => this.activitiesMenuItem({
      id: `chat-context:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesChatContextPalette(option.key),
      counter: this.activitiesChatContextFilterCount(option.key),
      active: option.key === this.chatContextFilter,
      context: { menu: 'chat-context', value: option.key }
    }));
  }

  protected activitiesRateMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activitiesRateFilterLabel(),
      icon: this.activitiesRateFilterIcon(this.rateFilter),
      palette: this.activitiesRatePalette(this.rateFilter),
      counter: this.selectedRateFilterCount()
    });
  }

  protected activitiesRateMenuModel(): AppMenuModel<string, ActivitiesPopupControlsMenuContext> {
    type RateMenuNode = Omit<AppMenuGroup<string, ActivitiesPopupControlsMenuContext>, 'items' | 'headerActions'> & {
      items: AppMenuItem<string, ActivitiesPopupControlsMenuContext>[];
      headerActions?: AppMenuItem<string, ActivitiesPopupControlsMenuContext>[];
    };
    const nodes: RateMenuNode[] = [];
    let currentNode: typeof nodes[number] | null = null;
    for (const option of this.rateFilterEntries) {
      if (option.kind === 'group') {
        const groupLabel = option.label;
        const groupPalette = this.activitiesRateGroupPalette(groupLabel);
        currentNode = {
          id: `rate-group:${groupLabel}`,
          label: this.rateGroupOptionLabelKey(groupLabel),
          icon: this.rateSocialBadgeGroupIconForGroup(groupLabel),
          palette: groupPalette,
          items: [],
          headerActions: this.shouldShowRateSocialBadgeToggleForGroup(groupLabel)
            ? [{
              id: `rate-social:${groupLabel}`,
              label: this.rateSocialBadgeButtonLabelForGroup(groupLabel),
              icon: this.rateSocialBadgeToggleIconForGroup(groupLabel),
              kind: 'toggle',
              active: this.isRateSocialBadgeToggleActiveForGroup(groupLabel),
              closeOnSelect: false,
              palette: groupPalette,
              context: { menu: 'rate-social', value: groupLabel }
            }]
            : []
        };
        nodes.push(currentNode);
        continue;
      }
      if (!currentNode) {
        currentNode = {
          id: 'rate-group:default',
          label: 'rate.type',
          icon: 'list',
          palette: 'gold',
          items: []
        };
        nodes.push(currentNode);
      }
      currentNode.items.push(this.activitiesMenuItem({
        id: `rate:${option.key}`,
        label: this.rateFilterOptionLabel(option.key),
        icon: this.activitiesRateFilterIcon(option.key),
        palette: this.activitiesRatePalette(option.key),
        counter: this.rateFilterCount(option.key),
        active: option.key === this.rateFilter,
        context: { menu: 'rate', value: option.key }
      }));
    }
    return { nodes };
  }

  protected activitiesSecondaryMenuTrigger(): AppMenuTrigger {
    const filter = this.effectiveActivitiesSecondaryFilter();
    return this.activitiesSelectTrigger({
      label: this.activitiesSecondaryFilterLabel(),
      icon: this.activitiesSecondaryFilterIcon(),
      palette: this.activitiesSecondaryPalette(filter),
      layout: 'pill',
      hideLabel: this.isMobileView
    });
  }

  protected activitiesSecondaryMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.availableActivitiesSecondaryFilters().map(option => this.activitiesMenuItem({
      id: `secondary:${option.key}`,
      label: this.activitiesSecondaryFilterOptionLabel(option.key),
      icon: option.icon,
      palette: this.activitiesSecondaryPalette(option.key),
      active: option.key === this.effectiveActivitiesSecondaryFilter(),
      context: { menu: 'secondary', value: option.key }
    }));
  }

  protected activitiesViewMenuTrigger(): AppMenuTrigger {
    return this.activitiesSelectTrigger({
      label: this.activityViewLabel(),
      icon: this.activitiesViewOptions.find(option => option.key === this.view)?.icon ?? 'view_agenda',
      palette: this.activitiesViewPalette(this.view),
      layout: 'pill',
      hideLabel: this.isMobileView
    });
  }

  protected activitiesViewMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return this.activitiesViewOptions.map(option => this.activitiesMenuItem({
      id: `view:${option.key}`,
      label: option.label,
      icon: option.icon,
      palette: this.activitiesViewPalette(option.key),
      active: option.key === this.view,
      context: { menu: 'view', value: option.key }
    }));
  }

  protected activitiesQuickActionsMenuTrigger(): AppMenuTrigger {
    return {
      icon: 'add',
      closeIcon: 'close',
      ariaLabel: 'Open event actions',
      hideLabel: true,
      layout: 'icon',
      palette: 'green'
    };
  }

  protected activitiesQuickActionsMenuItems(): readonly AppMenuItem<string, ActivitiesPopupControlsMenuContext>[] {
    return [
      {
        id: 'quick-action:explore',
        label: 'Explore',
        icon: 'explore',
        palette: 'violet',
        surface: 'tinted',
        context: { menu: 'quick-action', value: 'explore' }
      },
      {
        id: 'quick-action:create',
        label: 'Create Event',
        icon: 'add_circle',
        palette: 'green',
        surface: 'tinted',
        context: { menu: 'quick-action', value: 'create' }
      }
    ];
  }

  protected onActivitiesControlsMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as ActivitiesPopupControlsMenuContext | undefined;
    if (!context) {
      return;
    }
    switch (context.menu) {
      case 'primary':
        this.action.emit({ type: 'primaryFilter', value: context.value });
        return;
      case 'event-scope':
        this.action.emit({ type: 'eventScope', value: context.value });
        return;
      case 'chat-context':
        this.action.emit({ type: 'chatContextFilter', value: context.value });
        return;
      case 'rate':
        this.action.emit({ type: 'rateFilter', value: context.value });
        return;
      case 'rate-social':
        this.action.emit({ type: 'rateSocialBadgeGroup', value: context.value });
        return;
      case 'secondary':
        this.action.emit({ type: 'secondaryFilter', value: context.value });
        return;
      case 'view':
        this.action.emit({ type: 'view', value: context.value, sourceEvent: event.sourceEvent });
        return;
      case 'support-case':
        this.action.emit({ type: 'supportCaseFilter', value: context.value });
        return;
      case 'quick-action':
        if (context.value === 'explore') {
          this.action.emit({ type: 'eventExplore' });
          return;
        }
        this.action.emit({ type: 'eventEditor' });
        return;
      default:
        return;
    }
  }

  private supportCaseFilterLabelKey(filter: ContractTypes.SupportCaseFilter = this.supportCaseFilter): string {
    return this.activitiesSupportCaseFilters.find(option => option.key === filter)?.labelKey ?? 'activities.support.case.filter.all';
  }

  private supportCaseFilterIcon(filter: ContractTypes.SupportCaseFilter = this.supportCaseFilter): string {
    return this.activitiesSupportCaseFilters.find(option => option.key === filter)?.icon ?? 'list';
  }

  private supportCaseFilterCount(filter: ContractTypes.SupportCaseFilter = this.supportCaseFilter): number {
    return this.countFrom(this.supportCaseCounts, filter);
  }

  private activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find(option => option.key === this.primaryFilter)?.label ?? 'Chats';
  }

  private activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find(option => option.key === this.primaryFilter)?.icon ?? 'chat';
  }

  private activitiesPrimaryFilterCount(filter: ContractTypes.ActivitiesPrimaryFilter): number {
    return this.countFrom(this.primaryCounts, filter);
  }

  private activitiesEventScopeLabel(): string {
    return this.activitiesEventScopeFilters.find(option => option.key === this.eventScope)?.label ?? 'Active Events';
  }

  private activitiesEventScopeIcon(): string {
    return this.activitiesEventScopeFilters.find(option => option.key === this.eventScope)?.icon ?? 'event';
  }

  private activitiesEventScopeCount(scope: ContractTypes.ActivitiesEventScope = this.eventScope): number {
    return this.countFrom(this.eventScopeCounts, scope);
  }

  private activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find(option => option.key === this.chatContextFilter)?.label ?? 'All';
  }

  private activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find(option => option.key === this.chatContextFilter)?.icon ?? 'forum';
  }

  private activitiesChatContextFilterCount(filter: ContractTypes.ActivitiesChatContextFilter = this.chatContextFilter): number {
    if (this.primaryFilter !== 'chats') {
      return 0;
    }
    return this.countFrom(this.chatContextCounts, filter);
  }

  private activitiesChatsHeaderLabel(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.chatContextFilter === 'all') {
      return primary;
    }
    return `${primary} · ${this.activitiesChatContextFilterLabel()}`;
  }

  private activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.effectiveActivitiesSecondaryFilter());
  }

  private activitiesSecondaryFilterOptionLabel(filter: ContractTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.primaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(option => option.key === filter)?.label ?? 'Relevant';
  }

  private activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(option => option.key === this.effectiveActivitiesSecondaryFilter())?.icon ?? 'schedule';
  }

  private activitiesRateFilterLabel(): string {
    const label = this.rateFilterLabelForKey(this.rateFilter);
    if (!label) {
      return `${this.rateGroupLabelKeyForKey('individual-given')} · Given`;
    }
    const group = this.rateGroupLabelKeyForKey(this.rateFilter);
    return `${group} · ${label}`;
  }

  private rateFilterOptionLabel(key: ContractTypes.RateFilterKey): string {
    return this.rateFilterLabelForKey(key);
  }

  private rateGroupOptionLabelKey(label: string): string {
    const normalized = label.trim().toLowerCase();
    if (normalized === 'preferences') {
      return 'activity.rates.group.preferences';
    }
    if (normalized === 'suggestions') {
      return 'activity.rates.group.suggestions';
    }
    return label;
  }

  private activitiesRateFilterIcon(key: ContractTypes.RateFilterKey = this.rateFilter): string {
    const icons: Record<ContractTypes.RateFilterKey, string> = {
      'individual-given': 'north_east',
      'individual-received': 'south_west',
      'individual-mutual': 'sync_alt',
      'individual-met': 'handshake',
      'pair-given': 'group_add',
      'pair-received': 'groups_2'
    };
    return icons[key] ?? 'star';
  }

  private rateFilterCount(filter: ContractTypes.RateFilterKey): number {
    return this.countFrom(this.rateFilterCounts, filter);
  }

  private selectedRateFilterCount(): number {
    return this.rateFilterCount(this.rateFilter);
  }

  private shouldShowRateSocialBadgeToggle(): boolean {
    return this.primaryFilter === 'rates';
  }

  private shouldShowRateSocialBadgeToggleForGroup(label: string): boolean {
    if (!this.shouldShowRateSocialBadgeToggle()) {
      return false;
    }
    const normalized = label.trim().toLowerCase();
    return normalized === 'individual'
      || normalized === 'pair'
      || normalized === 'preferences'
      || normalized === 'suggestions'
      || normalized === this.rateGroupLabelKeyForKey('individual-given')
      || normalized === this.rateGroupLabelKeyForKey('pair-given');
  }

  private rateSocialBadgeButtonLabelForGroup(label: string): string {
    return this.isRateSocialBadgeToggleActiveForGroup(label) ? 'Social on' : 'Social off';
  }

  private rateSocialBadgeToggleIconForGroup(label: string): string {
    return this.isRateSocialBadgeToggleActiveForGroup(label) ? 'sell' : 'sell_off';
  }

  private rateSocialBadgeGroupIconForGroup(label: string): string {
    return this.rateSocialGroupForLabel(label) === 'pair' ? 'groups_2' : 'person';
  }

  private isRateSocialBadgeToggleActiveForGroup(label: string): boolean {
    const group = this.rateSocialGroupForLabel(label);
    return group === 'pair'
      ? this.pairRateSocialBadgeEnabled
      : this.individualRateSocialBadgeEnabled;
  }

  private rateFilterLabelForKey(key: ContractTypes.RateFilterKey): string {
    return this.rateFilters.find(option => option.key === key)?.label ?? 'Given';
  }

  private rateGroupLabelKeyForKey(key: ContractTypes.RateFilterKey): string {
    return key.startsWith('individual')
      ? 'activity.rates.group.preferences'
      : 'activity.rates.group.suggestions';
  }

  private rateSocialGroupForLabel(labelOrGroup: string): 'individual' | 'pair' {
    const normalized = labelOrGroup.trim().toLowerCase();
    if (
      normalized === 'pair'
      || normalized === 'suggestions'
      || normalized === this.rateGroupLabelKeyForKey('pair-given')
    ) {
      return 'pair';
    }
    return 'individual';
  }

  private activityViewLabel(): string {
    return this.activitiesViewOptions.find(option => option.key === this.view)?.label ?? 'View';
  }

  private availableActivitiesSecondaryFilters(): ReadonlyArray<{ key: ContractTypes.ActivitiesSecondaryFilter; label: string; icon: string }> {
    return this.isEventActivitiesPrimaryFilter()
      ? this.activitiesSecondaryFilters.filter(option => option.key !== 'relevant')
      : this.activitiesSecondaryFilters;
  }

  private effectiveActivitiesSecondaryFilter(): ContractTypes.ActivitiesSecondaryFilter {
    return this.isEventActivitiesPrimaryFilter() && this.secondaryFilter === 'relevant'
      ? 'recent'
      : this.secondaryFilter;
  }

  private activitiesSelectTrigger(options: {
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    layout?: AppMenuTrigger['layout'];
    hideLabel?: boolean;
  }): AppMenuTrigger {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      label: options.label,
      icon: options.icon,
      palette: options.palette,
      layout: options.layout ?? 'pill',
      hideLabel: options.hideLabel,
      counter: counter > 0 ? { value: counter, max: 99 } : null
    };
  }

  private activitiesMenuItem(options: {
    id: string;
    label: string;
    icon: string;
    palette: AppMenuPalette;
    counter?: number;
    active: boolean;
    context: ActivitiesPopupControlsMenuContext;
  }): AppMenuItem<string, ActivitiesPopupControlsMenuContext> {
    const counter = Math.max(0, Math.trunc(Number(options.counter) || 0));
    return {
      id: options.id,
      label: options.label,
      icon: options.icon,
      kind: 'radio',
      active: options.active,
      palette: options.palette,
      surface: 'tinted',
      counter: counter > 0 ? { value: counter, max: 99 } : null,
      context: options.context
    };
  }

  private activitiesPrimaryPalette(filter: ContractTypes.ActivitiesPrimaryFilter): AppMenuPalette {
    switch (filter) {
      case 'rates':
        return 'gold';
      case 'events':
        return 'orange';
      case 'hosting':
        return 'green';
      case 'invitations':
        return 'violet';
      case 'chats':
      default:
        return 'blue';
    }
  }

  private activitiesEventScopePalette(scope: ContractTypes.ActivitiesEventScope): AppMenuPalette {
    switch (scope) {
      case 'trash':
        return 'danger';
      case 'drafts':
        return 'slate';
      case 'invitations':
        return 'violet';
      case 'my-events':
        return 'green';
      case 'pending':
        return 'amber';
      case 'all':
        return 'blue';
      case 'active-events':
      default:
        return 'orange';
    }
  }

  private activitiesChatContextPalette(filter: ContractTypes.ActivitiesChatContextFilter): AppMenuPalette {
    switch (filter) {
      case 'event':
        return 'orange';
      case 'subEvent':
        return 'violet';
      case 'group':
        return 'green';
      case 'service':
        return 'slate';
      case 'all':
      default:
        return 'blue';
    }
  }

  private activitiesViewPalette(view: ContractTypes.ActivitiesView): AppMenuPalette {
    switch (view) {
      case 'distance':
        return 'teal';
      case 'month':
        return 'gold';
      case 'week':
        return 'green';
      case 'day':
      default:
        return 'blue';
    }
  }

  private activitiesSecondaryPalette(filter: ContractTypes.ActivitiesSecondaryFilter): AppMenuPalette {
    switch (filter) {
      case 'past':
        return 'slate';
      case 'relevant':
        return 'violet';
      case 'recent':
      default:
        return 'blue';
    }
  }

  private activitiesRatePalette(filter: ContractTypes.RateFilterKey): AppMenuPalette {
    switch (filter) {
      case 'individual-given':
        return 'pink';
      case 'individual-received':
        return 'blue';
      case 'individual-mutual':
        return 'violet';
      case 'individual-met':
        return 'green';
      case 'pair-given':
        return 'brown';
      case 'pair-received':
      default:
        return 'success';
    }
  }

  private supportCasePalette(filter: ContractTypes.SupportCaseFilter): AppMenuPalette {
    switch (filter) {
      case 'pending':
        return 'amber';
      case 'picked':
        return 'blue';
      case 'solved':
        return 'green';
      case 'blocked':
        return 'danger';
      case 'all':
      default:
        return 'neutral';
    }
  }

  private activitiesRateGroupPalette(label: string): AppMenuPalette {
    return this.rateSocialGroupForLabel(label) === 'pair' ? 'violet' : 'blue';
  }

  private countFrom<T extends string>(counts: Partial<Record<T, number>>, key: T): number {
    const value = Number(counts[key] ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(value));
  }
}
