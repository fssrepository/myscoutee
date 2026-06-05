import { Injectable, inject } from '@angular/core';

import { LocalMediaRepository } from '../repositories/media.repository';

export interface DemoMediaUploadResult {
  uploaded: boolean;
  imageUrl: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LocalMediaService {
  private readonly mediaRepository = inject(LocalMediaRepository);

  async uploadImage(scope: string, ownerId: string, entityId: string, file: File): Promise<DemoMediaUploadResult> {
    const imageUrl = this.createDemoObjectUrl(file) ?? await this.readImageDataUrl(file);
    if (imageUrl && !imageUrl.startsWith('data:')) {
      await this.persistDemoImageObject(scope, ownerId, entityId, file, imageUrl);
    }
    return {
      uploaded: Boolean(imageUrl),
      imageUrl
    };
  }

  private readImageDataUrl(file: File): Promise<string | null> {
    if (!file || !file.type.toLowerCase().startsWith('image/')) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  private createDemoObjectUrl(file: File): string | null {
    if (!file || !file.type.toLowerCase().startsWith('image/') || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }

  private async persistDemoImageObject(scope: string, ownerId: string, entityId: string, file: File, imageUrl: string): Promise<void> {
    try {
      await this.mediaRepository.saveImage({
        scope: scope.trim() || 'content',
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
      // The object URL remains usable in the current demo session.
    }
  }
}
