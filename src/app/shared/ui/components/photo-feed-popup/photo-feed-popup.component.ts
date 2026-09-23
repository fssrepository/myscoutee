import { Component, ViewChild, effect, inject } from '@angular/core';
import { defer, map } from 'rxjs';
import { PhotoFeedStore } from '../../context/stores/photo-feed.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PopupComponent, type PopupModel } from '../core/popup';
import { SmartListComponent, InfoCardComponent, type InfoCardData, type SmartListConfig, type SmartListLoadPage } from '../core/smart-list';
import { PhotoFeedConverter } from '../../converters/photo-feed.converter';
import type { PhotoFeedPost } from '../../../core/contracts/photo-feed.interface';

@Component({
  selector: 'app-photo-feed-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent],
  template: `
    <app-popup [model]="popupModel()">
      <app-smart-list [config]="config" [loadPage]="loadPage" [itemTemplate]="cardTemplate"></app-smart-list>
      <ng-template #cardTemplate let-card>
        <app-info-card [card]="card" (mediaEndClick)="store.view(card.eagerDetail)"></app-info-card>
      </ng-template>
    </app-popup>
  `
})
export class PhotoFeedPopupComponent {
  protected readonly store = inject(PhotoFeedStore);
  private readonly i18n = inject(I18nService);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<InfoCardData<PhotoFeedPost>>;
  protected readonly config: SmartListConfig<InfoCardData<PhotoFeedPost>> = {
    pageSize: 10, listLayout: 'card-grid', desktopColumns: 2, mobileColumns: 1,
    trackBy: (_index, card) => card.id, cacheable: true, sortable: true,
    groupBy: card => card.groupLabel ?? '',
    snapMode: 'mandatory', initialScrollAnchor: 'first-item', scrollPaddingTop: '2.6rem',
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    emptyLabel: () => this.i18n.translate('feed.empty')
  };
  protected readonly loadPage: SmartListLoadPage<InfoCardData<PhotoFeedPost>> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page, items: PhotoFeedConverter.convertList(page.items) })));
  constructor() {
    effect(() => {
      const post = this.store.created();
      if (post) this.list?.reinsertVisibleItem(PhotoFeedConverter.convert(post), { totalDelta: 1, loadedRange: 'any' });
    });
  }
  protected popupModel(): PopupModel {
    return { title: this.i18n.translate('feed.title'), size: 'wide', height: 'full', bodyLayout: 'fill',
      mobilePresentation: 'fullscreen', headerLayout: 'document',
      headerActions: [{ id: 'add', icon: 'add', ariaLabel: this.i18n.translate('feed.create'), palette: 'warning' }],
      onAction: () => this.store.add(), onClose: () => this.store.close() };
  }
}
