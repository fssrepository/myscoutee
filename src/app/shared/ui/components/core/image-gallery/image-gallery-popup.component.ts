import { I18nPipe } from '../../../pipes';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageCarouselComponent } from '../image-carousel/image-carousel.component';
import { PopupComponent, PopupModel } from '../popup';
import { ImageGalleryStore } from '../../../context/stores/image-gallery.store';

@Component({
  selector: 'app-image-gallery-popup',
  standalone: true,
  imports: [I18nPipe, FormsModule, ImageCarouselComponent, PopupComponent],
  template: `
    @for (gallery of store.request() ? [store.request()!] : []; track gallery.token) {
      <app-popup [model]="popupModel()">
        @if (store.error()) { <p class="gallery-error" role="alert">{{ 'image.gallery.saveFailed' | i18n }}</p> }
        <div class="gallery-content" [class.gallery-content--readonly]="gallery.readOnly">
          <app-image-carousel
            [disabled]="store.saving()" (uploadingChange)="store.setUploading(gallery.token, $event)"
            [imageDetails]="gallery.imageDetails ?? {}" [detailsEditable]="!gallery.readOnly"
            (imageDetailsChange)="store.updateDetails(gallery.token, $event)"
            [slotCount]="gallery.slotCount" [highlightFirst]="!gallery.readOnly"
            [previewMode]="!gallery.readOnly" [readOnly]="gallery.readOnly" [slideshow]="gallery.readOnly"
            [slotImageVariant]="gallery.readOnly ? 'large' : 'small'" mediaFit="contain"
            [ariaLabel]="gallery.title" [uploadOwnerId]="gallery.uploadOwnerId" [uploadEntityId]="gallery.uploadEntityId"
            [ngModel]="gallery.images" (ngModelChange)="store.updateImages(gallery.token, $event)"
          ></app-image-carousel>
        </div>
      </app-popup>
    }
  `,
  styles: [`
    .gallery-error { margin: .5rem 1rem; color: #b42318; }
    .gallery-content { display: flex; flex: 1; min-height: 0; padding: .9rem; }
    .gallery-content--readonly { padding: 0; }
  `]
})
export class ImageGalleryPopupComponent {
  protected readonly store = inject(ImageGalleryStore);
  protected popupModel(): PopupModel {
    const gallery = this.store.request();
    return {
      title: gallery?.title,
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerLayout: 'document',
      headerPalette: 'slate',
      mobilePresentation: 'fullscreen',
      showClose: !this.store.saving(),
      headerActions: !gallery?.readOnly && gallery?.onSave ? [{ id: 'save', icon: 'check', ariaLabel: 'save', palette: 'success',
        disabled: this.store.saving() || this.store.uploading() || !gallery.images.length }] : [],
      onAction: () => { if (gallery) void this.store.save(gallery.token); },
      onClose: () => this.store.close(gallery?.token)
    };
  }
}
