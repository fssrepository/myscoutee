import { Injectable, inject } from '@angular/core';

import { ChatVoiceClipsService } from '../../../base/services/chat-voice-clips.service';
import { LocalMediaRepository } from '../repositories/media.repository';
import { LocalRouteDelayService } from './route-delay.service';

const LOCAL_MEDIA_IMAGE_UPLOAD_ROUTE = '/media/images';
const LOCAL_MEDIA_IMAGE_IMPORT_ROUTE = '/media/images/import';
const LOCAL_MEDIA_AUDIO_UPLOAD_ROUTE = '/media/audio';

export interface LocalMediaImageUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

export interface LocalMediaAudioUploadResult {
  uploaded: boolean;
  audioUrl: string | null;
}

export interface LocalMediaAudioUploadOptions {
  dataUrl?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class LocalMediaService extends LocalRouteDelayService {
  private readonly mediaRepository = inject(LocalMediaRepository);
  private readonly chatVoiceClipsService = inject(ChatVoiceClipsService);

  async uploadImage(ownerId: string, entityId: string, file: File): Promise<LocalMediaImageUploadResult> {
    await this.waitForRouteDelay(LOCAL_MEDIA_IMAGE_UPLOAD_ROUTE);
    const imageUrl = await this.readFileDataUrl(file, 'image/') ?? this.createLocalObjectUrl(file, 'image/');
    if (imageUrl && !imageUrl.startsWith('data:')) {
      await this.persistLocalImageObject(ownerId, entityId, file, imageUrl);
    }
    return {
      uploaded: Boolean(imageUrl),
      imageUrl
    };
  }

  async importImage(
    ownerId: string,
    entityId: string,
    imageUrl: string
  ): Promise<LocalMediaImageUploadResult> {
    await this.waitForRouteDelay(LOCAL_MEDIA_IMAGE_IMPORT_ROUTE);
    const normalizedImageUrl = imageUrl.trim();
    if (!normalizedImageUrl) {
      return {
        uploaded: false,
        imageUrl: null
      };
    }

    const file = await this.fetchMediaFile(
      normalizedImageUrl,
      this.localFileName(entityId, 'imported-image', 'jpg'),
      'image/'
    );
    if (!file) {
      return {
        uploaded: true,
        imageUrl: normalizedImageUrl
      };
    }

    const localImageUrl = await this.readFileDataUrl(file, 'image/') ?? this.createLocalObjectUrl(file, 'image/');
    if (localImageUrl && !localImageUrl.startsWith('data:')) {
      await this.persistLocalImageObject(ownerId, entityId, file, localImageUrl);
    }
    return {
      uploaded: Boolean(localImageUrl),
      imageUrl: localImageUrl
    };
  }

  async uploadAudio(
    _ownerId: string,
    entityId: string,
    file: File,
    options: LocalMediaAudioUploadOptions = {}
  ): Promise<LocalMediaAudioUploadResult> {
    await this.waitForRouteDelay(LOCAL_MEDIA_AUDIO_UPLOAD_ROUTE);
    const normalizedEntityId = entityId.trim();
    if (!normalizedEntityId) {
      return {
        uploaded: false,
        audioUrl: null
      };
    }

    const dataUrl = options.dataUrl?.trim() || await this.readFileDataUrl(file, 'audio/');
    if (!dataUrl) {
      return {
        uploaded: false,
        audioUrl: null
      };
    }

    try {
      const audioUrl = await this.chatVoiceClipsService.saveVoiceClip(normalizedEntityId, {
        dataUrl,
        mimeType: file.type || 'audio/webm',
        durationSeconds: Math.max(0, Math.trunc(Number(options.durationSeconds) || 0)),
        sizeBytes: Math.max(0, Math.trunc(Number(options.sizeBytes ?? file.size) || 0))
      });
      return {
        uploaded: true,
        audioUrl
      };
    } catch {
      return {
        uploaded: false,
        audioUrl: null
      };
    }
  }

  private readFileDataUrl(file: File, contentTypePrefix: string): Promise<string | null> {
    if (!file || !file.type.toLowerCase().startsWith(contentTypePrefix)) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  private createLocalObjectUrl(file: File, contentTypePrefix: string): string | null {
    if (!file || !file.type.toLowerCase().startsWith(contentTypePrefix) || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }

  private async fetchMediaFile(url: string, fileName: string, contentTypePrefix: string): Promise<File | null> {
    if (typeof fetch !== 'function') {
      return null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok && !url.startsWith('data:') && !url.startsWith('blob:')) {
        return null;
      }
      const blob = await response.blob();
      const contentType = (blob.type || response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith(contentTypePrefix)) {
        return null;
      }
      return new File([blob], fileName, { type: contentType });
    } catch {
      return null;
    }
  }

  private async persistLocalImageObject(ownerId: string, entityId: string, file: File, imageUrl: string): Promise<void> {
    try {
      await this.mediaRepository.saveImage({
        ownerId: ownerId.trim() || 'admin',
        entityId: entityId.trim() || 'shared',
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        imageUrl,
        blob: file,
        createdAtIso: new Date().toISOString()
      });
    } catch {
      // The object URL remains usable in the current local session.
    }
  }

  private localFileName(value: string, fallback: string, extension: string): string {
    const normalizedValue = value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${normalizedValue || fallback}.${extension}`;
  }
}
