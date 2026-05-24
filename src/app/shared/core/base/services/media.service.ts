import { Injectable, inject } from '@angular/core';

import { DemoMediaService } from '../../demo/services/media.service';
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
  private readonly demoMediaService = inject(DemoMediaService);
  private readonly httpMediaService = inject(HttpMediaService);

  async uploadImage(scope: string, ownerId: string, entityId: string, file: File): Promise<MediaImageUploadResult> {
    return this.mediaService().uploadImage(scope, ownerId, entityId, file);
  }

  private mediaService(): DemoMediaService | HttpMediaService {
    return this.resolveRouteService('/media/images', this.demoMediaService, this.httpMediaService);
  }
}
