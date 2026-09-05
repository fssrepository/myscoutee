import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../common/app.db';

interface StoredPaymentCardArtwork {
  key: string;
  contentType: string;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class LocalPaymentCardArtworkRepository {
  private static readonly PREFIX = 'mediaImage:payment-card-artwork:';
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly objectUrls = new Map<string, string>();

  async resolveUrl(key: string): Promise<string> {
    const normalizedKey = key.trim();
    const cached = this.objectUrls.get(normalizedKey);
    if (cached) {
      return cached;
    }
    await this.memoryDb.whenReady();
    const storageKey = `${LocalPaymentCardArtworkRepository.PREFIX}${normalizedKey}`;
    const stored = await this.memoryDb.readIndexedDbTableEntry<StoredPaymentCardArtwork>(storageKey);
    const blob = stored?.blob instanceof Blob
      ? stored.blob
      : new Blob([this.svgFor(normalizedKey)], { type: 'image/svg+xml' });
    if (!(stored?.blob instanceof Blob)) {
      await this.memoryDb.writeIndexedDbTableEntry(storageKey, {
        key: normalizedKey,
        contentType: blob.type,
        blob
      } satisfies StoredPaymentCardArtwork);
    }
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(normalizedKey, url);
    return url;
  }

  private svgFor(key: string): string {
    const palettes: Record<string, [string, string, string]> = {
      midnight: ['#0b1638', '#2844a4', '#36c3d9'],
      emerald: ['#063c38', '#0d806d', '#8bcf85'],
      coral: ['#551728', '#a7354b', '#f18b65'],
      graphite: ['#171b24', '#3b4655', '#a9b2bd'],
      orbit: ['#32155e', '#7936a8', '#dc4da5'],
      aurora: ['#083f82', '#087fba', '#42d5cf']
    };
    const [start, middle, end] = palettes[key] ?? palettes['midnight'];
    const safeId = key.replace(/[^a-z0-9-]/gi, '') || 'card';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 756">
      <defs>
        <linearGradient id="g-${safeId}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${start}"/><stop offset=".58" stop-color="${middle}"/><stop offset="1" stop-color="${end}"/>
        </linearGradient>
        <linearGradient id="chip-${safeId}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff4bd"/><stop offset=".5" stop-color="#bda764"/><stop offset="1" stop-color="#fff0a0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="756" rx="54" fill="url(#g-${safeId})"/>
      <circle cx="1040" cy="100" r="310" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="56"/>
      <circle cx="1080" cy="170" r="190" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="25"/>
      <path d="M-60 680 C250 400 430 700 710 410 S1120 90 1290 220" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="35"/>
      <g transform="translate(112 205)">
        <rect width="168" height="126" rx="22" fill="url(#chip-${safeId})" stroke="#695f39" stroke-opacity=".5" stroke-width="5"/>
        <path d="M0 43h168M0 84h168M58 0v126M112 0v126" stroke="#756b43" stroke-opacity=".55" stroke-width="4"/>
      </g>
    </svg>`;
  }
}
