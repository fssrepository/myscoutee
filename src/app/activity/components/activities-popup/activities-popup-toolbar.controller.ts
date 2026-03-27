import type * as AppTypes from '../../../shared/core/base/models';
type ActivitiesToolbarHost = any;

export class ActivitiesPopupToolbarController {
  constructor(private readonly host: ActivitiesToolbarHost) {}

  private get activitiesPrimaryFilters() { return this.host.activitiesPrimaryFilters as typeof this.host.activitiesPrimaryFilters; }
  private get activitiesPrimaryFilter() { return this.host.activitiesPrimaryFilter as AppTypes.ActivitiesPrimaryFilter; }
  private get activitiesEventScopeFilters() { return this.host.activitiesEventScopeFilters as typeof this.host.activitiesEventScopeFilters; }
  private get activitiesEventScope() { return this.host.activitiesEventScope as AppTypes.ActivitiesEventScope; }
  private get activitiesChatContextFilters() { return this.host.activitiesChatContextFilters as typeof this.host.activitiesChatContextFilters; }
  private get activitiesChatContextFilter() { return this.host.activitiesChatContextFilter as AppTypes.ActivitiesChatContextFilter; }
  private get activitiesSecondaryFilters() { return this.host.activitiesSecondaryFilters as typeof this.host.activitiesSecondaryFilters; }
  private get activitiesSecondaryFilter() { return this.host.activitiesSecondaryFilter as AppTypes.ActivitiesSecondaryFilter; }
  private get hostingPublicationFilter() { return this.host.hostingPublicationFilter as AppTypes.HostingPublicationFilter; }
  private get activitiesRateFilter() { return this.host.activitiesRateFilter as AppTypes.RateFilterKey; }
  private get activitiesRateSocialBadgeEnabled() { return this.host.activitiesRateSocialBadgeEnabled as boolean; }
  private set activitiesRateSocialBadgeEnabled(value: boolean) { this.host.activitiesRateSocialBadgeEnabled = value; }
  private get activitiesView() { return this.host.activitiesView as AppTypes.ActivitiesView; }
  private get activitiesViewOptions() { return this.host.activitiesViewOptions as typeof this.host.activitiesViewOptions; }
  private get activitiesRates() { return this.host.activitiesRates; }
  private get activitiesSmartList() { return this.host.activitiesSmartList; }
  private get activitiesContext() { return this.host.activitiesContext; }
  private get popupCtx() { return this.host.popupCtx; }
  private get cdr() { return this.host.cdr; }
  private get rateFilters() { return this.host.rateFilters as typeof this.host.rateFilters; }
  private get rateItems() { return this.host.rateItems as typeof this.host.rateItems; }
  private get hostingItems() { return this.host.hostingItems as typeof this.host.hostingItems; }
  private get chatBadge() { return this.host.chatBadge as number; }
  private get invitationsBadge() { return this.host.invitationsBadge as number; }
  private get eventsBadge() { return this.host.eventsBadge as number; }
  private get hostingBadge() { return this.host.hostingBadge as number; }
  private get gameBadge() { return this.host.gameBadge as number; }
  private get isMobileView() { return this.host.isMobileView as boolean; }
  private get showActivitiesViewPicker() { return this.host.showActivitiesViewPicker as boolean; }
  private set showActivitiesViewPicker(value: boolean) { this.host.showActivitiesViewPicker = value; }
  private get showActivitiesSecondaryPicker() { return this.host.showActivitiesSecondaryPicker as boolean; }
  private set showActivitiesSecondaryPicker(value: boolean) { this.host.showActivitiesSecondaryPicker = value; }
  private get showActivitiesPrimaryPicker() { return this.host.showActivitiesPrimaryPicker as boolean; }
  private set showActivitiesPrimaryPicker(value: boolean) { this.host.showActivitiesPrimaryPicker = value; }
  private get showActivitiesEventScopePicker() { return this.host.showActivitiesEventScopePicker as boolean; }
  private set showActivitiesEventScopePicker(value: boolean) { this.host.showActivitiesEventScopePicker = value; }
  private get showActivitiesChatContextPicker() { return this.host.showActivitiesChatContextPicker as boolean; }
  private set showActivitiesChatContextPicker(value: boolean) { this.host.showActivitiesChatContextPicker = value; }
  private get showActivitiesRatePicker() { return this.host.showActivitiesRatePicker as boolean; }
  private set showActivitiesRatePicker(value: boolean) { this.host.showActivitiesRatePicker = value; }
  private get showActivitiesQuickActionsMenu() { return this.host.showActivitiesQuickActionsMenu as boolean; }
  private set showActivitiesQuickActionsMenu(value: boolean) { this.host.showActivitiesQuickActionsMenu = value; }
  private get selectedActivityRateId() { return this.host.selectedActivityRateId as string | null; }
  private set selectedActivityRateId(value: string | null) { this.host.selectedActivityRateId = value; }
  private get lastRateIndicatorPulseRowId() { return this.host.lastRateIndicatorPulseRowId as string | null; }
  private set lastRateIndicatorPulseRowId(value: string | null) { this.host.lastRateIndicatorPulseRowId = value; }

  private isEventActivitiesPrimaryFilter(): boolean { return this.host.isEventActivitiesPrimaryFilter(); }
  private isHostingPublished(id: string): boolean { return this.host.isHostingPublished(id); }
  private isActivityIdentityTrashed(type: AppTypes.ActivityListRow['type'], id: string): boolean { return this.host.isActivityIdentityTrashed(type, id); }
  private trashedActivityCount(): number { return this.host.trashedActivityCount(); }
  private chatItemsForActivities() { return this.host.chatItemsForActivities(); }
  private activityChatContextFilterKey(item: any) { return this.host.activityChatContextFilterKey(item); }
  private activitiesEventScopeLabel(): string { return this.host.activitiesEventScopeLabel(); }
  private effectiveActivitiesSecondaryFilter(): AppTypes.ActivitiesSecondaryFilter { return this.host.effectiveActivitiesSecondaryFilter(); }
  private resetActivitiesScroll(): void { this.host.resetActivitiesScroll(); }
  private openActivityRowInEventModule(row: AppTypes.ActivityListRow, readOnly: boolean): void { this.host.openActivityRowInEventModule(row, readOnly); }

  activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find((o: any) => o.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }

  activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find((o: any) => o.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }

  activitiesPrimaryFilterClass(filter: AppTypes.ActivitiesPrimaryFilter = this.activitiesPrimaryFilter): string {
    const map: Record<AppTypes.ActivitiesPrimaryFilter, string> = {
      chats: 'activity-filter-chat',
      invitations: 'activity-filter-invitations',
      events: 'activity-filter-events',
      hosting: 'activity-filter-hosting',
      rates: 'activity-filter-rates'
    };
    return map[filter] ?? 'activity-filter-chat';
  }

  activitiesPrimaryFilterCount(filter: AppTypes.ActivitiesPrimaryFilter): number {
    if (filter === 'rates') { return this.gameBadge; }
    if (filter === 'chats') { return this.chatBadge; }
    return 0;
  }

  activitiesPrimaryPanelWidth(): string {
    return '200px';
  }

  activitiesEventScopePanelWidth(): string {
    return '260px';
  }

  activitiesEventScopeIcon(): string {
    return this.activitiesEventScopeFilters.find((option: any) => option.key === this.activitiesEventScope)?.icon ?? 'event';
  }

  activitiesEventScopeClass(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): string {
    if (scope === 'trash') {
      return 'activity-filter-trash';
    }
    if (scope === 'drafts') {
      return 'activity-filter-drafts';
    }
    if (scope === 'invitations') {
      return 'activity-filter-invitations';
    }
    if (scope === 'my-events') {
      return 'activity-filter-hosting';
    }
    return 'activity-filter-events';
  }

  activitiesEventScopeCount(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): number {
    if (scope === 'all') {
      return this.eventsBadge + this.invitationsBadge + this.hostingBadge;
    }
    if (scope === 'drafts') {
      return this.hostingDraftCount();
    }
    if (scope === 'trash') {
      return this.trashedActivityCount();
    }
    if (scope === 'active-events') {
      return this.eventsBadge;
    }
    if (scope === 'invitations') {
      return this.invitationsBadge;
    }
    return this.hostingBadge;
  }

  activitiesRatePanelWidth(): string {
    return '272px';
  }

  activitiesHeaderLineOne(): string {
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
      const label = this.rateFilterLabelForKey(this.activitiesRateFilter);
      return `${group} Rate · ${label}`;
    }
    if (this.isEventActivitiesPrimaryFilter()) {
      if (this.activitiesView === 'month' || this.activitiesView === 'week') {
        return `Events · ${this.activitiesEventScopeLabel()}`;
      }
      return `${this.activitiesEventScopeLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
    }
    if (this.activitiesView === 'month' || this.activitiesView === 'week') {
      return this.activitiesPrimaryFilterLabel();
    }
    return `${this.activitiesPrimaryFilterLabel()} · ${this.activitiesSecondaryFilterLabel()}`;
  }

  activitiesHeaderLineTwo(): string {
    return '';
  }

  activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find((o: any) => o.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }

  activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find((o: any) => o.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }

  activitiesChatContextFilterClass(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): string {
    const map: Record<AppTypes.ActivitiesChatContextFilter, string> = {
      all: 'chat-context-filter-all',
      event: 'chat-context-filter-event',
      subEvent: 'chat-context-filter-sub-event',
      group: 'chat-context-filter-group'
    };
    return map[filter] ?? 'chat-context-filter-all';
  }

  activitiesSecondaryFilterClass(_filter: AppTypes.ActivitiesSecondaryFilter = this.activitiesSecondaryFilter): string {
    return 'activity-filter-secondary';
  }

  activitiesChatContextFilterCount(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') { return 0; }
    return this.chatItemsForActivities().filter((item: any) => {
      if (filter === 'all') { return true; }
      return this.activityChatContextFilterKey(item) === filter;
    }).length;
  }

  private activitiesChatsHeaderLabel(): string {
    const primary = this.activitiesPrimaryFilterLabel();
    if (this.activitiesChatContextFilter === 'all') {
      return primary;
    }
    return `${primary} · ${this.activitiesChatContextFilterLabel()}`;
  }

  activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.effectiveActivitiesSecondaryFilter());
  }

  activitiesSecondaryFilterOptionLabel(filter: AppTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find((o: any) => o.key === filter)?.label ?? 'Relevant';
  }

  activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find((o: any) => o.key === this.effectiveActivitiesSecondaryFilter())?.icon ?? 'schedule';
  }

  activitiesRateFilterLabel(): string {
    const label = this.rateFilterLabelForKey(this.activitiesRateFilter);
    if (!label) { return 'Single · Given'; }
    const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    return `${group} · ${label}`;
  }

  rateFilterOptionLabel(key: AppTypes.RateFilterKey): string {
    return this.rateFilterLabelForKey(key);
  }

  activitiesRateFilterIcon(key: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    const icons: Record<AppTypes.RateFilterKey, string> = {
      'individual-given': 'north_east',
      'individual-received': 'south_west',
      'individual-mutual': 'sync_alt',
      'individual-met': 'handshake',
      'pair-given': 'group_add',
      'pair-received': 'groups_2'
    };
    return icons[key] ?? 'star';
  }

  activitiesRateFilterClass(_filter: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    return 'activity-filter-rates';
  }

  rateFilterOptionClass(key: AppTypes.RateFilterKey): string {
    return `rate-filter-item-${key}`;
  }

  isRateGroupSeparator(label: string): boolean {
    return label.trim().toLowerCase().includes('pair');
  }

  rateFilterCount(filter: AppTypes.RateFilterKey): number {
    return this.rateItems.filter((item: any) => this.activitiesRates.matchesFilter(item, filter)).length;
  }

  selectedRateFilterCount(): number {
    return this.rateFilterCount(this.activitiesRateFilter);
  }

  shouldShowRateSocialBadgeToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  rateSocialBadgeButtonLabel(): string {
    return this.activitiesRateSocialBadgeEnabled ? 'Social on' : 'Social off';
  }

  toggleRateSocialBadge(): void {
    this.activitiesRateSocialBadgeEnabled = !this.activitiesRateSocialBadgeEnabled;
    if (this.activitiesRateFilter.startsWith('pair')) {
      this.activitiesSmartList?.reload();
    }
    this.cdr.markForCheck();
  }

  private rateFilterLabelForKey(key: AppTypes.RateFilterKey): string {
    if (this.activitiesRateSocialBadgeEnabled && key === 'pair-given') {
      return 'Separated friends';
    }
    if (this.activitiesRateSocialBadgeEnabled && key === 'pair-received') {
      return 'Friends in common';
    }
    return this.rateFilters.find((option: any) => option.key === key)?.label ?? 'Given';
  }

  totalRateFilterCount(): number {
    return this.rateItems.length;
  }

  activityViewLabel(): string {
    return this.activitiesViewOptions.find((o: any) => o.key === this.activitiesView)?.label ?? 'View';
  }

  isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  isHostingPublicationFilterVisible(): boolean {
    return false;
  }

  hostingDraftCount(): number {
    return this.hostingItems
      .filter((item: any) => item.isAdmin)
      .filter((item: any) => !this.isActivityIdentityTrashed('hosting', item.id))
      .filter((item: any) => !this.isHostingPublished(item.id))
      .length;
  }

  shouldShowActivitiesQuickActions(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && this.activitiesEventScope !== 'all'
      && this.activitiesEventScope !== 'active-events'
      && this.activitiesEventScope !== 'invitations'
      && this.activitiesEventScope !== 'trash';
  }

  shouldShowStandaloneEventExploreAction(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && (this.activitiesEventScope === 'all' || this.activitiesEventScope === 'active-events');
  }

  availableActivitiesSecondaryFilters(): ReadonlyArray<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }> {
    return this.isEventActivitiesPrimaryFilter()
      ? this.activitiesSecondaryFilters.filter((option: any) => option.key !== 'relevant')
      : this.activitiesSecondaryFilters;
  }

  selectActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates' || filter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
    if (filter !== 'rates') {
      this.activitiesRates.disableFullscreenMode();
    }
    this.activitiesContext.setActivitiesPrimaryFilter(filter);
    if (filter === 'events' && this.activitiesSecondaryFilter === 'relevant') {
      this.activitiesContext.setActivitiesSecondaryFilter('recent');
    }
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesEventScopePicker(event: Event): void {
    if (!this.isEventActivitiesPrimaryFilter()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesEventScopePicker = !this.showActivitiesEventScopePicker;
  }

  selectActivitiesEventScope(scope: AppTypes.ActivitiesEventScope): void {
    const currentScope = this.activitiesContext.activitiesEventScope() as AppTypes.ActivitiesEventScope;
    if (!this.isEventActivitiesPrimaryFilter() || currentScope === scope) {
      this.showActivitiesEventScopePicker = false;
      return;
    }
    this.activitiesContext.setActivitiesEventScope(scope);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
    if (this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    this.activitiesContext.setActivitiesChatContextFilter(filter);
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (!this.isHostingPublicationFilterVisible() || this.hostingPublicationFilter === filter) {
      return;
    }
    this.activitiesContext.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    const normalizedFilter = this.isEventActivitiesPrimaryFilter() && filter === 'relevant'
      ? 'recent'
      : filter;
    if (this.activitiesPrimaryFilter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
    this.activitiesContext.setActivitiesSecondaryFilter(normalizedFilter);
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
    const currentFilter = this.activitiesContext.activitiesRateFilter() as AppTypes.RateFilterKey;
    if (currentFilter === filter) {
      this.showActivitiesPrimaryPicker = false;
      this.showActivitiesEventScopePicker = false;
      this.showActivitiesChatContextPicker = false;
      this.showActivitiesSecondaryPicker = false;
      this.showActivitiesRatePicker = false;
      this.showActivitiesQuickActionsMenu = false;
      return;
    }
    this.activitiesRates.commitPendingDirectionOverrides(filter);
    this.activitiesContext.setActivitiesRateFilter(filter);
    this.lastRateIndicatorPulseRowId = null;
    this.selectedActivityRateId = null;
    this.activitiesContext.setActivitiesSelectedRateId(null);
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesViewPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesContext.toggleActivitiesViewPicker();
  }

  toggleActivitiesSecondaryPicker(event: Event): void {
    event.stopPropagation();
    if (this.activitiesPrimaryFilter === 'chats') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.activitiesContext.toggleActivitiesSecondaryPicker();
  }

  setActivitiesView(view: AppTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesPrimaryFilter === 'rates') {
      this.activitiesRates.commitPendingDirectionOverrides();
    }
    if (view !== 'distance') {
      this.activitiesRates.disableFullscreenMode();
    }
    this.activitiesContext.setActivitiesView(view as 'day' | 'week' | 'month' | 'distance');
    this.lastRateIndicatorPulseRowId = null;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  toggleActivitiesQuickActionsMenu(event: Event): void {
    if (!this.shouldShowActivitiesQuickActions()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = !this.showActivitiesQuickActionsMenu;
  }

  openMobileActivitiesPrimaryFilterSelector(event: Event): void {
    if (!this.isMobileView) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesPrimaryPicker = !this.showActivitiesPrimaryPicker;
  }

  openMobileActivitiesEventScopeSelector(event: Event): void {
    if (!this.isMobileView || !this.isEventActivitiesPrimaryFilter()) {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesEventScopePicker = !this.showActivitiesEventScopePicker;
  }

  openMobileActivitiesChatContextFilterSelector(event: Event): void {
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'chats') {
      return;
    }
    event.stopPropagation();
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesRatePicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesChatContextPicker = !this.showActivitiesChatContextPicker;
  }

  openMobileActivitiesRateFilterSelector(event: Event): void {
    event.stopPropagation();
    if (!this.isMobileView || this.activitiesPrimaryFilter !== 'rates') {
      return;
    }
    this.showActivitiesPrimaryPicker = false;
    this.showActivitiesEventScopePicker = false;
    this.showActivitiesChatContextPicker = false;
    this.showActivitiesViewPicker = false;
    this.showActivitiesSecondaryPicker = false;
    this.showActivitiesQuickActionsMenu = false;
    this.showActivitiesRatePicker = !this.showActivitiesRatePicker;
  }

  requestOpenEventEditor(): void {
    const target: AppTypes.EventEditorTarget = this.isEventActivitiesPrimaryFilter()
      ? (this.activitiesEventScope === 'my-events' || this.activitiesEventScope === 'drafts' ? 'hosting' : 'events')
      : 'events';
    this.showActivitiesQuickActionsMenu = false;
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target
    });
  }

  requestOpenEventEditorForRow(
    row: AppTypes.ActivityListRow,
    readOnly = false,
    stacked = true
  ): void {
    void stacked;
    this.openActivityRowInEventModule(row, readOnly);
  }

  requestOpenEventExplore(): void {
    this.showActivitiesQuickActionsMenu = false;
    this.popupCtx.requestActivitiesNavigation({ type: 'eventExplore' });
  }
}
