import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../db';
import type { ChatVoiceClip } from '../models';
import { chatVoiceClipTableKey } from '../storage-scope';

@Injectable({
  providedIn: 'root'
})
export class ChatVoiceClipsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async saveVoiceClip(key: string, clip: ChatVoiceClip): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    if (!normalizedKey) {
      throw new Error('Voice clip key is required.');
    }
    await this.memoryDb.writeIndexedDbTableEntry(this.storageKey(normalizedKey), this.cloneClip(clip));
  }

  async loadVoiceClip(key: string): Promise<ChatVoiceClip | null> {
    const normalizedKey = this.normalizeKey(key);
    if (!normalizedKey) {
      return null;
    }
    const clip = await this.memoryDb.readIndexedDbTableEntry<ChatVoiceClip>(this.storageKey(normalizedKey));
    return clip ? this.cloneClip(clip) : null;
  }

  private storageKey(key: string): string {
    return chatVoiceClipTableKey(key);
  }

  private normalizeKey(key: string): string {
    return `${key ?? ''}`.trim();
  }

  private cloneClip(clip: ChatVoiceClip): ChatVoiceClip {
    return {
      dataUrl: `${clip.dataUrl ?? ''}`,
      mimeType: `${clip.mimeType ?? ''}`.trim() || 'audio/webm',
      durationSeconds: Math.max(0, Math.trunc(Number(clip.durationSeconds) || 0)),
      sizeBytes: Math.max(0, Math.trunc(Number(clip.sizeBytes) || 0))
    };
  }
}
