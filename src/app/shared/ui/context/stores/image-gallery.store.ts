import { ImageDetailsMap, normalizeImageDetails } from '../../../core/contracts/image-gallery.interface';
import { Injectable, signal } from '@angular/core';

export interface ImageGalleryRequest {
  images: readonly string[];
  imageDetails?: ImageDetailsMap;
  onDetailsChange?: (details: ImageDetailsMap) => void;
  slotCount: number;
  readOnly: boolean;
  title: string;
  uploadOwnerId: string;
  uploadEntityId: string;
  onSave?: (images: string[], details: ImageDetailsMap) => Promise<void>;
  onChange?: (images: string[]) => void;
}

@Injectable({ providedIn: 'root' })
export class ImageGalleryStore {
  private readonly requestRef = signal<(ImageGalleryRequest & { token: object }) | null>(null);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal(false);
  readonly request = this.requestRef.asReadonly();

  open(request: ImageGalleryRequest): object {
    const token = {};
    this.saving.set(false); this.uploading.set(false); this.error.set(false);
    this.requestRef.set({ ...request, images: [...request.images], imageDetails: normalizeImageDetails(request.imageDetails, request.images), token });
    return token;
  }

  close(token?: object): void {
    if (!token || this.request()?.token === token) this.requestRef.set(null);
  }

  setUploading(token: object, value: boolean): void {
    if (this.request()?.token === token) this.uploading.set(value);
  }

  async save(token: object): Promise<void> {
    const request = this.request();
    if (!request || request.token !== token || request.readOnly || !request.onSave
      || this.saving() || this.uploading() || !request.images.length) return;
    this.saving.set(true); this.error.set(false);
    try {
      await request.onSave([...request.images], normalizeImageDetails(request.imageDetails, request.images));
      this.close(token);
    } catch {
      if (this.request()?.token === token) this.error.set(true);
    } finally {
      if (!this.request() || this.request()?.token === token) this.saving.set(false);
    }
  }

  updateImages(token: object, images: readonly string[]): void {
    const request = this.request();
    if (!request || request.token !== token || request.readOnly || this.saving() || images.length > request.slotCount) return;
    const next = [...images];
    const imageDetails = normalizeImageDetails(request.imageDetails, next);
    this.requestRef.set({ ...request, images: next, imageDetails });
    request.onDetailsChange?.(imageDetails);
    request.onChange?.(next);
  }
  updateDetails(token: object, details: ImageDetailsMap): void {
    const request = this.request();
    if (!request || request.token !== token || request.readOnly || this.saving()) return;
    const imageDetails = normalizeImageDetails(details, request.images);
    this.requestRef.set({ ...request, imageDetails });
    request.onDetailsChange?.(imageDetails);
  }

}
