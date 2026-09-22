import { ImageDetailsMap } from '../../../../core/contracts/image-gallery.interface';
import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageCarouselComponent } from '../image-carousel/image-carousel.component';
import { ImageGalleryStore } from '../../../context/stores/image-gallery.store';

/** Single cover; expansion delegates to the shared signal-driven gallery popup. */
@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [FormsModule, ImageCarouselComponent],
  templateUrl: './image-gallery.component.html',
  styles: [':host { display: flex; width: 100%; min-width: 0; }']
})
export class ImageGalleryComponent implements OnChanges, OnDestroy {
  private readonly store = inject(ImageGalleryStore);
  private token?: object;
  @Input() images: readonly string[] = [];
  @Input() readOnly = false;
  @Input() imageDetails: ImageDetailsMap = {};
  @Output() readonly imageDetailsChange = new EventEmitter<ImageDetailsMap>();
  @Input() slotCount = 8;
  @Input() uploadOwnerId = '';
  @Input() uploadEntityId = 'image';
  @Input() title = 'image.carousel.images';
  @Output() readonly imagesChange = new EventEmitter<string[]>();

  ngOnChanges(changes: SimpleChanges): void {
    if (this.token && (changes['readOnly'] || changes['uploadEntityId'] || changes['uploadOwnerId'])) {
      this.store.close(this.token);
      this.token = undefined;
    }
  }
  ngOnDestroy(): void { if (this.token) this.store.close(this.token); }

  protected openGallery(): void {
    this.token = this.store.open({
      images: this.images, imageDetails: this.imageDetails,
      onDetailsChange: details => { if (!this.readOnly) this.imageDetailsChange.emit(details); }, slotCount: this.slotCount, readOnly: this.readOnly,
      title: this.title, uploadOwnerId: this.uploadOwnerId, uploadEntityId: this.uploadEntityId,
      onChange: images => { if (!this.readOnly) this.imagesChange.emit(images); }
    });
  }

  protected updateCover(cover: readonly string[]): void {
    if (this.readOnly) return;
    this.imagesChange.emit([...cover, ...this.images.slice(1)]);
  }
}
