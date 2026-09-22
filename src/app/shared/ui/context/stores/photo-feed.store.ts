import { Injectable, effect, inject, signal } from '@angular/core';
import { PhotoFeedService } from '../../../core/base/services/photo-feed.service';
import { UserProfileStore } from './user-profile.store';
import { ImageGalleryStore } from './image-gallery.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type { PhotoFeedPost } from '../../../core/contracts/photo-feed.interface';

@Injectable({ providedIn: 'root' })
export class PhotoFeedStore {
  private readonly service = inject(PhotoFeedService);
  private readonly profile = inject(UserProfileStore);
  private readonly gallery = inject(ImageGalleryStore);
  private readonly i18n = inject(I18nService);
  readonly userId = signal<string | null>(null);
  readonly created = signal<PhotoFeedPost | null>(null);
  private galleryToken?: object;
  constructor() {
    effect(() => {
      if (this.userId() && this.userId() !== this.profile.activeUserId()) this.close();
    });
  }
  open(): void { this.created.set(null); this.userId.set(this.profile.activeUserId() || null); }
  close(): void {
    this.userId.set(null);
    if (this.galleryToken) this.gallery.close(this.galleryToken);
    this.galleryToken = undefined;
  }
  page(query: ListQuery, signal?: AbortSignal) {
    return this.service.page(this.userId() ?? '', query, signal);
  }
  add(): void {
    const userId = this.userId();
    if (!userId) return;
    const id = crypto.randomUUID();
    this.galleryToken = this.gallery.open({ images: [], imageDetails: {}, slotCount: 5, readOnly: false,
      title: this.i18n.translate('feed.create'), uploadOwnerId: userId, uploadEntityId: id,
      onSave: async (imageUrls, imageDetails) => {
        const post = await this.service.create({ userId, id, imageUrls, imageDetails });
        if (this.userId() === userId) this.created.set(post);
      } });
  }
  view(post: PhotoFeedPost): void {
    this.galleryToken = this.gallery.open({ images: post.imageUrls, imageDetails: post.imageDetails,
      slotCount: 5, readOnly: true, title: post.creatorName, uploadOwnerId: post.creatorUserId, uploadEntityId: post.id });
  }
}
