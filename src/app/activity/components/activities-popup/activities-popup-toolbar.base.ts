import { Directive } from '@angular/core';

import type * as AppTypes from '../../../shared/core/base/models';
import { ActivitiesPopupChatsBase } from './activities-popup-chats.base';

@Directive()
export abstract class ActivitiesPopupToolbarBase extends ActivitiesPopupChatsBase {
  protected activitiesPrimaryFilterLabel(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.label ?? 'Chats';
  }

  protected activitiesPrimaryFilterIcon(): string {
    return this.activitiesPrimaryFilters.find(o => o.key === this.activitiesPrimaryFilter)?.icon ?? 'chat';
  }

  protected activitiesPrimaryFilterClass(filter: AppTypes.ActivitiesPrimaryFilter = this.activitiesPrimaryFilter): string {
    const map: Record<AppTypes.ActivitiesPrimaryFilter, string> = {
      chats: 'activity-filter-chat',
      invitations: 'activity-filter-invitations',
      events: 'activity-filter-events',
      hosting: 'activity-filter-hosting',
      rates: 'activity-filter-rates'
    };
    return map[filter] ?? 'activity-filter-chat';
  }

  protected activitiesPrimaryFilterCount(filter: AppTypes.ActivitiesPrimaryFilter): number {
    if (filter === 'rates') { return this.gameBadge; }
    if (filter === 'chats') { return this.chatBadge; }
    return 0;
  }

  protected activitiesPrimaryPanelWidth(): string {
    return '200px';
  }

  protected activitiesEventScopePanelWidth(): string {
    return '260px';
  }

  protected activitiesEventScopeIcon(): string {
    return this.activitiesEventScopeFilters.find(option => option.key === this.activitiesEventScope)?.icon ?? 'event';
  }

  protected activitiesEventScopeClass(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): string {
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

  protected activitiesEventScopeCount(scope: AppTypes.ActivitiesEventScope = this.activitiesEventScope): number {
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

  protected activitiesRatePanelWidth(): string {
    return '220px';
  }

  protected activitiesHeaderLineOne(): string {
    if (this.activitiesPrimaryFilter === 'chats') {
      return this.activitiesChatsHeaderLabel();
    }
    if (this.activitiesPrimaryFilter === 'rates') {
      const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
      const label = this.rateFilters.find(option => option.key === this.activitiesRateFilter)?.label ?? 'Given';
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

  protected activitiesHeaderLineTwo(): string {
    return '';
  }

  protected activitiesChatContextFilterLabel(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.label ?? 'All';
  }

  protected activitiesChatContextFilterIcon(): string {
    return this.activitiesChatContextFilters.find(o => o.key === this.activitiesChatContextFilter)?.icon ?? 'forum';
  }

  protected activitiesChatContextFilterClass(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): string {
    const map: Record<AppTypes.ActivitiesChatContextFilter, string> = {
      all: 'chat-context-filter-all',
      event: 'chat-context-filter-event',
      subEvent: 'chat-context-filter-sub-event',
      group: 'chat-context-filter-group'
    };
    return map[filter] ?? 'chat-context-filter-all';
  }

  protected activitiesSecondaryFilterClass(_filter: AppTypes.ActivitiesSecondaryFilter = this.activitiesSecondaryFilter): string {
    return 'activity-filter-secondary';
  }

  protected activitiesChatContextFilterCount(filter: AppTypes.ActivitiesChatContextFilter = this.activitiesChatContextFilter): number {
    if (this.activitiesPrimaryFilter !== 'chats') { return 0; }
    return this.chatItemsForActivities().filter(item => {
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

  protected activitiesSecondaryFilterLabel(): string {
    return this.activitiesSecondaryFilterOptionLabel(this.effectiveActivitiesSecondaryFilter());
  }

  protected activitiesSecondaryFilterOptionLabel(filter: AppTypes.ActivitiesSecondaryFilter): string {
    if (filter === 'recent') {
      return this.activitiesPrimaryFilter === 'rates' ? 'Recent' : 'Upcoming';
    }
    return this.activitiesSecondaryFilters.find(o => o.key === filter)?.label ?? 'Relevant';
  }

  protected activitiesSecondaryFilterIcon(): string {
    return this.activitiesSecondaryFilters.find(o => o.key === this.effectiveActivitiesSecondaryFilter())?.icon ?? 'schedule';
  }

  protected activitiesRateFilterLabel(): string {
    const filter = this.rateFilters.find(o => o.key === this.activitiesRateFilter);
    if (!filter) { return 'Single · Given'; }
    const group = this.activitiesRateFilter.startsWith('individual') ? 'Single' : 'Pair';
    if (this.activitiesRateSocialBadgeEnabled && this.activitiesRateFilter === 'pair-given') {
      return `${group} · Separated friends`;
    }
    if (this.activitiesRateSocialBadgeEnabled && this.activitiesRateFilter === 'pair-received') {
      return `${group} · Friends in common`;
    }
    return `${group} · ${filter.label}`;
  }

  protected activitiesRateFilterIcon(key: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
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

  protected activitiesRateFilterClass(_filter: AppTypes.RateFilterKey = this.activitiesRateFilter): string {
    return 'activity-filter-rates';
  }

  protected rateFilterOptionClass(key: AppTypes.RateFilterKey): string {
    return `rate-filter-item-${key}`;
  }

  protected isRateGroupSeparator(label: string): boolean {
    return label.trim().toLowerCase().includes('pair');
  }

  protected rateFilterCount(filter: AppTypes.RateFilterKey): number {
    return this.rateItems.filter(item => this.matchesRateFilter(item, filter)).length;
  }

  protected shouldShowRateSocialBadgeToggle(): boolean {
    return this.activitiesPrimaryFilter === 'rates'
      && this.activitiesRateFilter.startsWith('pair');
  }

  protected rateSocialBadgeButtonLabel(): string {
    return this.activitiesRateSocialBadgeEnabled ? 'Social on' : 'Social off';
  }

  protected toggleRateSocialBadge(): void {
    this.activitiesRateSocialBadgeEnabled = !this.activitiesRateSocialBadgeEnabled;
    this.activitiesSmartList?.reload();
    this.cdr.markForCheck();
  }

  protected totalRateFilterCount(): number {
    return this.rateItems.length;
  }

  protected activityViewLabel(): string {
    return this.activitiesViewOptions.find(o => o.key === this.activitiesView)?.label ?? 'View';
  }

  protected isRateFilterVisible(): boolean {
    return this.activitiesPrimaryFilter === 'rates';
  }

  protected isHostingPublicationFilterVisible(): boolean {
    return false;
  }

  protected hostingDraftCount(): number {
    return this.hostingItems
      .filter(item => item.isAdmin)
      .filter(item => !this.isActivityIdentityTrashed('hosting', item.id))
      .filter(item => !this.isHostingPublished(item.id))
      .length;
  }

  protected shouldShowActivitiesQuickActions(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && this.activitiesEventScope !== 'all'
      && this.activitiesEventScope !== 'active-events'
      && this.activitiesEventScope !== 'invitations'
      && this.activitiesEventScope !== 'trash';
  }

  protected shouldShowStandaloneEventExploreAction(): boolean {
    return this.isEventActivitiesPrimaryFilter()
      && (this.activitiesEventScope === 'all' || this.activitiesEventScope === 'active-events');
  }

  protected availableActivitiesSecondaryFilters(): ReadonlyArray<{ key: AppTypes.ActivitiesSecondaryFilter; label: string; icon: string }> {
    return this.isEventActivitiesPrimaryFilter()
      ? this.activitiesSecondaryFilters.filter(option => option.key !== 'relevant')
      : this.activitiesSecondaryFilters;
  }

  protected selectActivitiesPrimaryFilter(filter: AppTypes.ActivitiesPrimaryFilter): void {
    if (this.activitiesPrimaryFilter === 'rates' || filter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    if (filter !== 'rates') {
      this.disableActivitiesRatesFullscreenMode();
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

  protected toggleActivitiesEventScopePicker(event: Event): void {
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

  protected selectActivitiesEventScope(scope: AppTypes.ActivitiesEventScope): void {
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

  protected selectActivitiesChatContextFilter(filter: AppTypes.ActivitiesChatContextFilter): void {
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

  protected selectHostingPublicationFilter(filter: AppTypes.HostingPublicationFilter): void {
    if (!this.isHostingPublicationFilterVisible() || this.hostingPublicationFilter === filter) {
      return;
    }
    this.activitiesContext.setActivitiesHostingPublicationFilter(filter);
    this.resetActivitiesScroll();
    this.cdr.markForCheck();
  }

  protected selectActivitiesSecondaryFilter(filter: AppTypes.ActivitiesSecondaryFilter): void {
    const normalizedFilter = this.isEventActivitiesPrimaryFilter() && filter === 'relevant'
      ? 'recent'
      : filter;
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
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

  protected selectActivitiesRateFilter(filter: AppTypes.RateFilterKey): void {
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
    this.commitPendingRateDirectionOverrides(filter);
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

  protected toggleActivitiesViewPicker(event: Event): void {
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

  protected toggleActivitiesSecondaryPicker(event: Event): void {
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

  protected setActivitiesView(view: AppTypes.ActivitiesView, event?: Event): void {
    event?.stopPropagation();
    if (this.activitiesPrimaryFilter === 'rates') {
      this.commitPendingRateDirectionOverrides();
    }
    if (view !== 'distance') {
      this.disableActivitiesRatesFullscreenMode();
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

  protected toggleActivitiesQuickActionsMenu(event: Event): void {
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

  protected openMobileActivitiesPrimaryFilterSelector(event: Event): void {
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

  protected openMobileActivitiesEventScopeSelector(event: Event): void {
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

  protected openMobileActivitiesChatContextFilterSelector(event: Event): void {
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

  protected openMobileActivitiesRateFilterSelector(event: Event): void {
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

  protected requestOpenEventEditor(): void {
    const target: AppTypes.EventEditorTarget = this.isEventActivitiesPrimaryFilter()
      ? (this.activitiesEventScope === 'my-events' || this.activitiesEventScope === 'drafts' ? 'hosting' : 'events')
      : 'events';
    this.showActivitiesQuickActionsMenu = false;
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target
    });
  }

  protected requestOpenEventEditorForRow(
    row: AppTypes.ActivityListRow,
    readOnly = false,
    stacked = true
  ): void {
    void stacked;
    this.openActivityRowInEventModule(row, readOnly);
  }

  protected requestOpenEventExplore(): void {
    this.showActivitiesQuickActionsMenu = false;
    this.popupCtx.requestActivitiesNavigation({ type: 'eventExplore' });
  }
}
