import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { defer } from 'rxjs';
import { PhotoFeedService } from '../../../core/base/services/photo-feed.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { ImageEventReference } from '../../../core/contracts/image-gallery.interface';
import type { PhotoFeedEventOption } from '../../../core/contracts/photo-feed.interface';
import { PopupComponent, type PopupModel } from '../core/popup';
import { SmartListComponent, InfoCardComponent, type InfoCardData, type SmartListConfig, type SmartListLoadPage } from '../core/smart-list';

@Component({
  selector: 'app-photo-feed-event-picker', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent],
  template: `
    <app-popup [model]="popupModel()">
      <app-smart-list [config]="config" [loadPage]="loadPage" [itemTemplate]="eventTemplate"></app-smart-list>
      <ng-template #eventTemplate let-option>
        <app-info-card [card]="card(option)" (mediaEndClick)="selected.set(option.event)"></app-info-card>
      </ng-template>
    </app-popup>
  `
})
export class PhotoFeedEventPickerComponent {
  @Input({ required: true }) userId = '';
  @Input() set initial(event: ImageEventReference | null | undefined) { this.selected.set(event ?? null); }
  @Output() readonly picked = new EventEmitter<ImageEventReference | null>();
  private readonly service = inject(PhotoFeedService);
  private readonly i18n = inject(I18nService);
  protected readonly selected = signal<ImageEventReference | null>(null);
  protected readonly config: SmartListConfig<PhotoFeedEventOption> = {
    pageSize: 10, listLayout: 'card-grid', desktopColumns: 3,
    trackBy: (_index, option) => option.event.id,
    headerProgress: { enabled: true },
    emptyLabel: () => this.i18n.translate('feed.event.empty')
  };
  protected readonly loadPage: SmartListLoadPage<PhotoFeedEventOption> = query =>
    defer(() => this.service.events(this.userId, query));
  protected card(option: PhotoFeedEventOption): InfoCardData {
    const selected = option.event.id === this.selected()?.id;
    return { id: option.event.id, title: option.event.title, imageUrl: option.imageUrl,
      metaRows: [option.event.organizerName, option.event.location],
      dateIso: option.startAtIso, clickable: false, i18nIgnoreContent: true,
      mediaEnd: { variant: 'badge', tone: 'public', icon: selected ? 'check' : 'add', selected,
        ariaLabel: selected ? 'feed.event.selected' : 'feed.event.select', interactive: true } };
  }
  protected popupModel(): PopupModel {
    return { title: 'feed.event.select', size: 'wide', height: 'full', bodyLayout: 'fill',
      mobilePresentation: 'fullscreen', backdropTone: 'dim', headerLayout: 'document',
      headerActions: [{ id: 'select', icon: 'check', counter: this.selected() ? 1 : null,
        ariaLabel: 'feed.event.confirm', palette: 'success', disabled: !this.selected() }],
      onAction: () => { if (this.selected()) this.picked.emit(this.selected()); },
      onClose: () => this.picked.emit(null) };
  }
}
