import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import type { EventExploreFilterPreferences } from '../../../shared/core/contracts/activity.interface';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppMenuComponent, I18nPipe, PopupComponent, buildTabbedMenuModel, type AppMenuItem, type AppMenuItemSelectEvent, type PopupModel } from '../../../shared/ui';
import { EventModeMenuConverter } from '../../../shared/ui/converters/event-mode-menu.converter';

@Component({
  selector: 'app-event-explore-filter-popup',
  standalone: true,
  imports: [AppMenuComponent, I18nPipe, PopupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-explore-filter-popup.component.html',
  styleUrl: './event-explore-filter-popup.component.scss'
})
export class EventExploreFilterPopupComponent implements OnChanges {
  @Input({ required: true }) filters!: EventExploreFilterPreferences;
  @Input() saving = false;
  @Input() followedMemberCount = 0;
  @Output() readonly membersOpened = new EventEmitter<void>();
  @Input() error = false;
  @Output() readonly closed = new EventEmitter<EventExploreFilterPreferences | null>();
  protected draft!: EventExploreFilterPreferences;
  protected readonly modes = EventModeMenuConverter;

  ngOnChanges(): void {
    if (!this.draft) this.draft = { ...this.filters };
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected escape(event: Event): void {
    if (event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  protected model(): PopupModel {
    return {
      title: 'event.explore.filters', size: 'small', height: 'auto', mobilePresentation: 'compact', headerTone: 'accent',
      bodyLayout: 'overflow',
      backdropTone: 'dim', closeOnBackdrop: !this.saving,
      headerControls: [{ kind: 'menu', id: 'apply-filters', menuKind: 'inline', items: [{
        id: 'apply', icon: 'check', kind: 'action', palette: 'green', disabled: this.saving,
        ariaLabel: 'event.filters.apply',
        progress: this.saving ? { state: 'loading', shape: 'circle' } : null
      }] }],
      onClose: () => this.close(),
      onMenuSelect: () => { if (!this.saving) this.closed.emit({ ...this.draft }); }
    };
  }

  protected toggles(): readonly AppMenuItem[] {
    return [
      { id: 'friendsOnly', label: 'friends.going', icon: 'groups', palette: 'green' as const },
      { id: 'openSpotsOnly', label: 'open.spots', icon: 'hotel', palette: 'blue' as const }
    ].map(item => ({ ...item, kind: 'toggle', layout: 'pill', showToggleIndicator: true, closeOnSelect: false,
      disabled: this.saving, checked: this.draft[item.id as 'friendsOnly' | 'openSpotsOnly' | 'followedOnly'] })) as AppMenuItem[];
  }

  protected followedToggle(): readonly AppMenuItem[] {
    return [{ id: 'followedOnly', label: 'event.following.only', icon: 'rss_feed', palette: 'violet',
      kind: 'toggle', layout: 'pill', showToggleIndicator: true, closeOnSelect: false,
      disabled: this.saving, checked: this.draft.followedOnly === true }];
  }

  protected memberItems(): readonly AppMenuItem[] {
    return [{ id: 'following-members', icon: 'format_list_bulleted', palette: 'violet',
      ariaLabel: 'event.following.members', counter: { value: this.followedMemberCount, max: 999 } }];
  }

  protected toggle(event: AppMenuItemSelectEvent): void {
    if (this.saving || (event.id !== 'friendsOnly' && event.id !== 'openSpotsOnly' && event.id !== 'followedOnly')) return;
    this.draft = { ...this.draft, [event.id]: !this.draft[event.id] };
  }

  protected modeTrigger() {
    return { ...this.modes.trigger(this.draft.mode), disabled: this.saving };
  }

  protected selectMode(event: AppMenuItemSelectEvent): void {
    if (this.saving) return;
    if (event.id === '' || event.id === 'Casual' || event.id === 'Tournament' || event.id === 'Mingle') {
      this.draft = { ...this.draft, mode: event.id };
    }
  }

  protected topics() {
    return buildTabbedMenuModel<string, string>({
      idPrefix: 'explore-topic', groups: APP_STATIC_DATA.interestOptionGroups,
      selected: this.draft.topic ? [this.draft.topic] : [], maxSelected: 1, kind: 'radio',
      context: topic => topic, itemLabel: topic => `#${topic.replace(/^#+\s*/, '')}`,
      summary: { emptyLabel: 'any', maxLabels: 1, counter: 'none' }
    });
  }

  protected selectTopic(event: AppMenuItemSelectEvent): void {
    if (this.saving || typeof event.context !== 'string') return;
    const topic = event.context;
    this.draft = { ...this.draft, topic: event.action === 'remove' || this.draft.topic === topic ? '' : topic };
  }

  private close(): void {
    if (!this.saving) this.closed.emit(null);
  }
}
