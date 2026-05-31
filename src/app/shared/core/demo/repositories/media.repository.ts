import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';

export interface DemoMediaImageRecord {
  scope: string;
  ownerId: string;
  entityId: string;
  fileName: string;
  contentType: string;
  size: number;
  imageUrl: string;
  blob: File;
  createdAtIso: string;
}

@Injectable({
  providedIn: 'root'
})
export class DemoMediaRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async saveImage(record: DemoMediaImageRecord): Promise<void> {
    await this.memoryDb.writeIndexedDbTableEntry(`mediaImage:${this.newId('media')}`, {
      ...record,
      scope: record.scope.trim() || 'content',
      ownerId: record.ownerId.trim() || 'admin',
      entityId: record.entityId.trim() || 'shared'
    });
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
