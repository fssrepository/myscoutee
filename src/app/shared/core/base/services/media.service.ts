import { Injectable, inject } from '@angular/core';

import { LocalMediaService } from '../../local/services/media.service';
import { HttpMediaService } from '../../http/services/media.service';
import { BaseRouteModeService } from './base-route-mode.service';

const MEDIA_IMAGE_UPLOAD_ROUTE = '/media/images';
const MEDIA_IMAGE_IMPORT_ROUTE = '/media/images/import';
const MEDIA_AUDIO_UPLOAD_ROUTE = '/media/audio';

export interface MediaImageUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

export interface MediaAudioUploadResult {
  uploaded: boolean;
  audioUrl: string | null;
}

export interface MediaAudioUploadOptions {
  dataUrl?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService extends BaseRouteModeService {
  private readonly localMediaService = inject(LocalMediaService);
  private readonly httpMediaService = inject(HttpMediaService);

  async uploadImage(ownerId: string, entityId: string, file: File): Promise<MediaImageUploadResult> {
    return this.mediaService(MEDIA_IMAGE_UPLOAD_ROUTE).uploadImage(ownerId, entityId, file);
  }

  async importImage(
    ownerId: string,
    entityId: string,
    imageUrl: string
  ): Promise<MediaImageUploadResult> {
    return this.mediaService(MEDIA_IMAGE_IMPORT_ROUTE).importImage(ownerId, entityId, imageUrl);
  }

  async uploadAudio(
    ownerId: string,
    entityId: string,
    file: File,
    options: MediaAudioUploadOptions = {}
  ): Promise<MediaAudioUploadResult> {
    return this.mediaService(MEDIA_AUDIO_UPLOAD_ROUTE).uploadAudio(ownerId, entityId, file, options);
  }

  private mediaService(route: string): LocalMediaService | HttpMediaService {
    return this.resolveRouteService(route, this.localMediaService, this.httpMediaService);
  }
}
