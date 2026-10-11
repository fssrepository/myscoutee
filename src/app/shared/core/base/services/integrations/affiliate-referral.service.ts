import { Injectable } from '@angular/core';

/** Referral intent survives the authentication redirect; only profile creation can consume it. */
@Injectable({ providedIn: 'root' })
export class AffiliateReferralService {
  private readonly key = 'myscoutee.affiliate-referral';
  private code = '';

  capture(value: string | null): void {
    if (!value || !/^[a-f0-9-]{36}$/.test(value)) return;
    if (this.pending()) return;
    this.code = value;
    try { globalThis.sessionStorage?.setItem(this.key, value); } catch { /* In-memory intent remains available. */ }
  }

  pending(): string | undefined {
    try { this.code ||= globalThis.sessionStorage?.getItem(this.key) ?? ''; } catch { /* Storage may be unavailable. */ }
    return /^[a-f0-9-]{36}$/.test(this.code) ? this.code : undefined;
  }

  clear(): void {
    this.code = '';
    try { globalThis.sessionStorage?.removeItem(this.key); } catch { /* No persistent storage. */ }
  }
}
