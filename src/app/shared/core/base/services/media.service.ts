import { Injectable, inject } from '@angular/core';

import { LocalMediaService } from '../../local/services/media.service';
import { HttpMediaService } from '../../http/services/media.service';
import { BaseRouteModeService } from './base-route-mode.service';

export interface MediaImageUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService extends BaseRouteModeService {
  private readonly localMediaService = inject(LocalMediaService);
  private readonly httpMediaService = inject(HttpMediaService);

  async uploadImage(scope: string, ownerId: string, entityId: string, file: File): Promise<MediaImageUploadResult> {
    return this.mediaService().uploadImage(scope, ownerId, entityId, file);
  }

  private mediaService(): LocalMediaService | HttpMediaService {
    return this.resolveRouteService('/media/images', this.localMediaService, this.httpMediaService);
  }
}
