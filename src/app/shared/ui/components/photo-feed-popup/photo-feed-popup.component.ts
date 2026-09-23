import { Component, ViewChild, effect, inject } from '@angular/core';
import { defer, map } from 'rxjs';
import { PhotoFeedStore } from '../../context/stores/photo-feed.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PopupComponent, type PopupModel } from '../core/popup';
import { SmartListComponent, InfoCardComponent, type InfoCardData, type SmartListConfig, type SmartListLoadPage } from '../core/smart-list';
import { PhotoFeedConverter } from '../../converters/photo-feed.converter';
import type { PhotoFeedPost, PhotoFeedFilters, PhotoFeedStatusFilter } from '../../../core/contracts/photo-feed.interface';
import { MODERATION_STATUSES } from '../../../core/contracts/content-moderation.interface';
import { MODERATION_STATUS_STYLE } from '../../converters/content-moderation-presentation';
import { FollowingStore } from '../../context/stores/following.store';
import { AppMenuDispatcher, AppMenuOutletComponent, type AppMenuItemSelectEvent } from '../core/menu';
import type { CardMenuRequestEvent } from '../core/smart-list/card';
import { PhotoFeedEventPickerComponent } from './photo-feed-event-picker.component';
import type { ImageEventReference } from '../../../core/contracts/image-gallery.interface';
import { DialogStore } from '../../context/stores/dialog.store';
import type { AppMenuItem } from '../core/menu';
import { ViewportSeenDirective } from '../../directives/viewport-seen.directive';

@Component({
  selector: 'app-photo-feed-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent, AppMenuOutletComponent, PhotoFeedEventPickerComponent, ViewportSeenDirective],
  providers: [AppMenuDispatcher],
  template: `
    <app-popup [model]="popupModel()">
      <app-smart-list [config]="config" [loadPage]="loadPage" [query]="query" [itemTemplate]="cardTemplate"></app-smart-list>
      <ng-template #cardTemplate let-card>
        <app-info-card [card]="card" [useSharedMenu]="true"
          [appViewportSeen]="status === 'public'" (viewportSeen)="store.seen(card.eagerDetail)"
          (menuRequest)="openCardMenu(card.eagerDetail, $event)"
          (mediaEndClick)="store.view(card.eagerDetail)"></app-info-card>
      </ng-template>
      <app-menu-outlet (itemSelect)="onMenuSelect($event)"></app-menu-outlet>
    </app-popup>
    @if (store.eventPicker(); as picker) {
      <app-photo-feed-event-picker [userId]="store.userId()!" [initial]="picker.initial"
        (picked)="store.pickEvent($event)"></app-photo-feed-event-picker>
    }
  `
})
export class PhotoFeedPopupComponent {
  protected readonly store = inject(PhotoFeedStore);
  private readonly i18n = inject(I18nService);
  private readonly followingStore = inject(FollowingStore);
  private readonly appMenuDispatcher = inject(AppMenuDispatcher);
  private readonly dialogStore = inject(DialogStore);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<InfoCardData<PhotoFeedPost>>;
  protected status: PhotoFeedStatusFilter = 'public';
  protected query = { filters: { status: this.status } };
  protected config: SmartListConfig<InfoCardData<PhotoFeedPost>, PhotoFeedFilters> = {
    pageSize: 10, listLayout: 'card-grid', desktopColumns: 3,
    trackBy: (_index, card) => card.id, cacheable: true, sortable: true,
    groupBy: card => card.groupLabel ?? '',
    snapMode: 'mandatory', initialScrollAnchor: 'first-item', scrollPaddingTop: '2.6rem',
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    pollIntervalMs: 0,
    emptyLabel: () => this.i18n.translate('feed.empty')
  };
  protected readonly loadPage: SmartListLoadPage<InfoCardData<PhotoFeedPost>, PhotoFeedFilters> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({
      ...page, items: PhotoFeedConverter.convertList(page.items, this.store.userId())
    })));
  constructor() {
    effect(() => {
      const post = this.store.created();
      if (post && post.moderationStatus === this.status) {
        this.list?.reinsertVisibleItem(PhotoFeedConverter.convert(post, this.store.userId()), { totalDelta: 1, loadedRange: 'any' });
      }
    });
  }
  protected openCardMenu(post: PhotoFeedPost, request: CardMenuRequestEvent<InfoCardData>): void {
    const event = post.imageDetails[request.imageUrl ?? post.imageUrls[0]]?.event;
    const items: AppMenuItem[] = [];
    if (event?.organizerId && event.organizerId !== this.store.userId()) {
      const followed = () => this.followingStore.state().organizerIds.includes(event.organizerId);
      items.push({ id: 'follow-organizer', label: () => followed() ? 'event.following.unfollow' : 'event.following.follow',
        icon: () => followed() ? 'remove_circle_outline' : 'rss_feed', palette: 'cyan', surface: 'tinted', context: event });
    }
    if (post.creatorUserId === this.store.userId()) items.push({ id: 'remove-feed', label: 'feed.remove',
      icon: 'delete', palette: 'danger', surface: 'tinted', context: post });
    if (!items.length) { request.closeTrigger(); return; }
    const id = `photo-feed-card:${request.id}`;
    if (this.appMenuDispatcher.isOpen(id)) {
      this.appMenuDispatcher.close(id);
      return;
    }
    this.appMenuDispatcher.open({
      id, kind: 'select', title: request.card.title,
      items,
      triggerRect: request.triggerRect, openUp: request.openUp, panelAlign: 'auto',
      closeOnSelect: true, onClose: request.closeTrigger
    }, null);
  }
  protected onMenuSelect(event: AppMenuItemSelectEvent): void {
    if (event.id === 'remove-feed') {
      const post = event.context as PhotoFeedPost;
      if (post.creatorUserId !== this.store.userId()) return;
      this.appMenuDispatcher.close();
      this.dialogStore.open({ title: 'feed.remove', message: 'feed.removeConfirm', confirmLabel: 'feed.remove',
        cancelLabel: 'Cancel', confirmPalette: 'danger', failureMessage: 'feed.removeFailed',
        onConfirm: async () => {
          await this.store.remove(post.id);
          this.list?.removeVisibleItemByIdentity(post.id, { totalDelta: -1 });
        } });
      return;
    }
    const linked = event.context as ImageEventReference | undefined;
    if (event.id !== 'follow-organizer' || !linked?.organizerId || linked.organizerId === this.store.userId()) return;
    this.appMenuDispatcher.close();
    this.followingStore.confirmChange(linked.organizerId, linked.organizerName,
      !this.followingStore.state().organizerIds.includes(linked.organizerId));
  }
  protected popupModel(): PopupModel {
    return { title: this.i18n.translate('feed.title'), size: 'wide', height: 'full', bodyLayout: 'fill',
      mobilePresentation: 'fullscreen', headerLayout: 'document',
      headerControls: [{ kind: 'menu', id: 'status', menuKind: 'select',
        trigger: { label: this.status === 'public' || this.status === 'seen' ? `feed.${this.status}` : `moderation.status.${this.status}`,
          ...(this.status === 'public' ? { icon: 'public', palette: 'blue' as const }
            : this.status === 'seen' ? { icon: 'visibility', palette: 'slate' as const } : MODERATION_STATUS_STYLE[this.status]),
          layout: 'pill', counter: this.status === 'public' || this.status === 'seen' ? undefined : { value: this.store.counters().counts[this.status] ?? 0, max: 9999 } },
        items: [{ id: 'public', label: 'feed.public', icon: 'public', palette: 'blue', surface: 'tinted', active: this.status === 'public' },
          { id: 'seen', label: 'feed.seen', icon: 'visibility', palette: 'slate', surface: 'tinted', active: this.status === 'seen' },
          ...MODERATION_STATUSES.map(id => ({ id, label: `moderation.status.${id}`, ...MODERATION_STATUS_STYLE[id], surface: 'tinted' as const, active: id === this.status,
            counter: { value: this.store.counters().counts[id] ?? 0, max: 9999 } }))] }],
      onMenuSelect: event => {
        const status = event.itemSelect.id as PhotoFeedStatusFilter;
        if (status !== 'public' && status !== 'seen' && !MODERATION_STATUSES.includes(status)) return;
        this.appMenuDispatcher.close();
        this.status = status;
        // Keep already-visible discovery cards stable while their receipts sync.
        // The next query/reopen excludes them; polling must not consume the feed without scrolling.
        this.config = { ...this.config, pollIntervalMs: status === 'public' ? 0 : 10000 };
        this.query = { filters: { status } };
      },
      headerActions: [{ id: 'add', icon: 'add', ariaLabel: this.i18n.translate('feed.create'), palette: 'warning' }],
      onAction: () => this.store.add(), onClose: () => this.store.close() };
  }
}
