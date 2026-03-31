import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';

export interface HttpMediaUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpMediaService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async uploadImage(
    scope: 'event' | 'asset',
    ownerId: string,
    entityId: string,
    file: File
  ): Promise<HttpMediaUploadResult> {
    const normalizedOwnerId = ownerId.trim();
    const normalizedEntityId = entityId.trim();
    if (!normalizedOwnerId || !normalizedEntityId) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    const formData = new FormData();
    formData.append('scope', scope);
    formData.append('ownerId', normalizedOwnerId);
    formData.append('entityId', normalizedEntityId);
    formData.append('image', file, file.name);
    try {
      type UploadResponse = {
        uploaded?: boolean | null;
        imageUrl?: string | null;
        url?: string | null;
      };
      const response = await this.http
        .post<UploadResponse | null>(`${this.apiBaseUrl}/media/images`, formData)
        .toPromise();
      const imageUrl =
        (typeof response?.imageUrl === 'string' && response.imageUrl.trim().length > 0
          ? response.imageUrl.trim()
          : null)
        ?? (typeof response?.url === 'string' && response.url.trim().length > 0
          ? response.url.trim()
          : null);
      return {
        uploaded: response?.uploaded !== false && imageUrl !== null,
        imageUrl
      };
    } catch {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
  }
}
