import { Injectable, inject } from '@angular/core';

import type { ChatVoiceClip } from '../../contracts';
import { ChatVoiceClipsRepository } from '../repositories/chat-voice-clips.repository';

@Injectable({
  providedIn: 'root'
})
export class ChatVoiceClipsService {
  private static readonly URL_PREFIX = 'indexeddb:';

  private readonly repository = inject(ChatVoiceClipsRepository);

  async saveVoiceClip(key: string, clip: ChatVoiceClip): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    if (!normalizedKey) {
      throw new Error('Voice clip key is required.');
    }
    await this.repository.saveVoiceClip(normalizedKey, clip);
    return this.voiceClipUrl(normalizedKey);
  }

  async loadVoiceClipByUrl(url: string): Promise<ChatVoiceClip | null> {
    const key = this.keyFromVoiceClipUrl(url);
    return key ? this.repository.loadVoiceClip(key) : null;
  }

  isVoiceClipUrl(url: string): boolean {
    return Boolean(this.keyFromVoiceClipUrl(url));
  }

  private voiceClipUrl(key: string): string {
    return `${ChatVoiceClipsService.URL_PREFIX}${key}`;
  }

  private keyFromVoiceClipUrl(url: string): string {
    const normalizedUrl = `${url ?? ''}`.trim();
    if (!normalizedUrl.startsWith(ChatVoiceClipsService.URL_PREFIX)) {
      return '';
    }
    return this.normalizeKey(normalizedUrl.slice(ChatVoiceClipsService.URL_PREFIX.length));
  }

  private normalizeKey(key: string): string {
    return `${key ?? ''}`.trim();
  }
}
