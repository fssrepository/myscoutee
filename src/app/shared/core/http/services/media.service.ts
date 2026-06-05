import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { RouteDelayService } from '../../base/services/route-delay.service';

const HTTP_MEDIA_IMAGE_UPLOAD_ROUTE = '/media/images';
const HTTP_MEDIA_IMAGE_IMPORT_ROUTE = '/media/images/import';
const HTTP_MEDIA_AUDIO_UPLOAD_ROUTE = '/media/audio';

export interface HttpMediaUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

export interface HttpMediaAudioUploadResult {
  uploaded: boolean;
  audioUrl: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpMediaService {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async uploadImage(
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
    formData.append('ownerId', normalizedOwnerId);
    formData.append('entityId', normalizedEntityId);
    formData.append('image', file, file.name);
    try {
      type UploadResponse = {
        uploaded?: boolean | null;
        imageUrl?: string | null;
        url?: string | null;
      };
      const response = await this.routeDelay.withRequestTimeout(
        HTTP_MEDIA_IMAGE_UPLOAD_ROUTE,
        this.http
          .post<UploadResponse | null>(`${this.apiBaseUrl}/media/images`, formData)
          .toPromise(),
        'Media image upload request timeout.'
      );
      const imageUrl = this.normalizeReturnedMediaUrl(
        (typeof response?.imageUrl === 'string' && response.imageUrl.trim().length > 0
          ? response.imageUrl.trim()
          : null)
        ?? (typeof response?.url === 'string' && response.url.trim().length > 0
          ? response.url.trim()
          : null)
      );
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

  async importImage(
    ownerId: string,
    entityId: string,
    imageUrl: string
  ): Promise<HttpMediaUploadResult> {
    const normalizedOwnerId = ownerId.trim();
    const normalizedEntityId = entityId.trim();
    const normalizedImageUrl = imageUrl.trim();
    if (!normalizedOwnerId || !normalizedEntityId || !normalizedImageUrl) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
    try {
      type UploadResponse = {
        uploaded?: boolean | null;
        imageUrl?: string | null;
        url?: string | null;
      };
      const response = await this.routeDelay.withRequestTimeout(
        HTTP_MEDIA_IMAGE_IMPORT_ROUTE,
        this.http
          .post<UploadResponse | null>(`${this.apiBaseUrl}/media/images/import`, {
            ownerId: normalizedOwnerId,
            entityId: normalizedEntityId,
            imageUrl: normalizedImageUrl
          })
          .toPromise(),
        'Media image import request timeout.'
      );
      const storedImageUrl = this.normalizeReturnedMediaUrl(
        (typeof response?.imageUrl === 'string' && response.imageUrl.trim().length > 0
          ? response.imageUrl.trim()
          : null)
        ?? (typeof response?.url === 'string' && response.url.trim().length > 0
          ? response.url.trim()
          : null)
      );
      return {
        uploaded: response?.uploaded === true && storedImageUrl !== null,
        imageUrl: storedImageUrl
      };
    } catch {
      return {
        uploaded: false,
        imageUrl: null
      };
    }
  }

  async uploadAudio(
    ownerId: string,
    entityId: string,
    file: File,
    _options?: unknown
  ): Promise<HttpMediaAudioUploadResult> {
    const normalizedOwnerId = ownerId.trim();
    const normalizedEntityId = entityId.trim();
    if (!normalizedOwnerId || !normalizedEntityId) {
      return {
        uploaded: false,
        audioUrl: null
      };
    }
    const formData = new FormData();
    formData.append('ownerId', normalizedOwnerId);
    formData.append('entityId', normalizedEntityId);
    formData.append('audio', file, file.name);
    try {
      type UploadResponse = {
        uploaded?: boolean | null;
        audioUrl?: string | null;
        url?: string | null;
      };
      const response = await this.routeDelay.withRequestTimeout(
        HTTP_MEDIA_AUDIO_UPLOAD_ROUTE,
        this.http
          .post<UploadResponse | null>(`${this.apiBaseUrl}/media/audio`, formData)
          .toPromise(),
        'Media audio upload request timeout.'
      );
      const audioUrl = this.normalizeReturnedMediaUrl(
        (typeof response?.audioUrl === 'string' && response.audioUrl.trim().length > 0
          ? response.audioUrl.trim()
          : null)
        ?? (typeof response?.url === 'string' && response.url.trim().length > 0
          ? response.url.trim()
          : null)
      );
      return {
        uploaded: response?.uploaded !== false && audioUrl !== null,
        audioUrl
      };
    } catch {
      return {
        uploaded: false,
        audioUrl: null
      };
    }
  }

  private normalizeReturnedMediaUrl(value: string | null): string | null {
    const url = `${value ?? ''}`.trim();
    if (!url) {
      return null;
    }
    if (/^(?:https?:|data:|blob:|indexeddb:)/i.test(url) || url.startsWith('/api/')) {
      return url;
    }
    const baseUrl = this.apiBaseUrl.replace(/\/+$/, '');
    if (url.startsWith('/media/')) {
      return `${baseUrl}${url}`;
    }
    if (url.startsWith('media/')) {
      return `${baseUrl}/${url}`;
    }
    return `${baseUrl}/media/public?key=${encodeURIComponent(url)}`;
  }
}
