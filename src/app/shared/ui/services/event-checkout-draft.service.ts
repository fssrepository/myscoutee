import { Injectable, signal } from '@angular/core';

import type { EventCheckoutLineItem } from '../../core/base/models';

export interface EventCheckoutDraft {
  userId: string;
  sourceId: string;
  eventTitle: string;
  eventTimeframe: string;
  slotSourceId: string | null;
  selectedDateKey: string | null;
  optionalSubEventIds: string[];
  acceptedPolicyIds: string[];
  lineItems: EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  checkoutSessionId: string | null;
  updatedAtMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventCheckoutDraftService {
  private static readonly STORAGE_KEY = 'myscoutee.event.checkout.drafts.v1';
  private readonly draftsRef = signal<Record<string, EventCheckoutDraft>>(this.readInitialDrafts());

  readonly drafts = this.draftsRef.asReadonly();

  read(userId: string, sourceId: string): EventCheckoutDraft | null {
    return this.draftsRef()[this.buildKey(userId, sourceId)] ?? null;
  }

  listByUser(userId: string): EventCheckoutDraft[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return Object.values(this.draftsRef())
      .filter(item => item.userId === normalizedUserId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  save(draft: EventCheckoutDraft): void {
    const normalized = this.normalizeDraft(draft);
    if (!normalized) {
      return;
    }
    const key = this.buildKey(normalized.userId, normalized.sourceId);
    const next = {
      ...this.draftsRef(),
      [key]: normalized
    };
    this.draftsRef.set(next);
    this.persist(next);
  }

  clear(userId: string, sourceId: string): void {
    const key = this.buildKey(userId, sourceId);
    const current = this.draftsRef();
    if (!current[key]) {
      return;
    }
    const next = { ...current };
    delete next[key];
    this.draftsRef.set(next);
    this.persist(next);
  }

  private buildKey(userId: string, sourceId: string): string {
    return `${userId.trim()}::${sourceId.trim()}`;
  }

  private normalizeDraft(draft: EventCheckoutDraft | null | undefined): EventCheckoutDraft | null {
    const userId = draft?.userId?.trim() ?? '';
    const sourceId = draft?.sourceId?.trim() ?? '';
    if (!userId || !sourceId) {
      return null;
    }
    return {
      userId,
      sourceId,
      eventTitle: draft?.eventTitle?.trim() || 'Checkout draft',
      eventTimeframe: draft?.eventTimeframe?.trim() || '',
      slotSourceId: draft?.slotSourceId?.trim() || null,
      selectedDateKey: draft?.selectedDateKey?.trim() || null,
      optionalSubEventIds: [...new Set(draft?.optionalSubEventIds ?? [])].map(item => item.trim()).filter(Boolean),
      acceptedPolicyIds: [...new Set(draft?.acceptedPolicyIds ?? [])].map(item => item.trim()).filter(Boolean),
      lineItems: (draft?.lineItems ?? []).map(item => ({
        id: item.id?.trim() ?? '',
        kind: item.kind,
        label: item.label?.trim() ?? '',
        detail: item.detail?.trim() ?? '',
        amount: Number(item.amount) || 0,
        currency: item.currency?.trim() || 'USD'
      })).filter(item => item.id && item.label),
      totalAmount: Math.max(0, Number(draft?.totalAmount) || 0),
      currency: draft?.currency?.trim() || 'USD',
      checkoutSessionId: draft?.checkoutSessionId?.trim() || null,
      updatedAtMs: Math.max(0, Math.trunc(Number(draft?.updatedAtMs) || Date.now()))
    };
  }

  private readInitialDrafts(): Record<string, EventCheckoutDraft> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(EventCheckoutDraftService.STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, EventCheckoutDraft>;
      const next: Record<string, EventCheckoutDraft> = {};
      for (const [key, value] of Object.entries(parsed ?? {})) {
        const normalized = this.normalizeDraft(value);
        if (normalized) {
          next[key] = normalized;
        }
      }
      return next;
    } catch {
      return {};
    }
  }

  private persist(drafts: Record<string, EventCheckoutDraft>): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(EventCheckoutDraftService.STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore storage write failures.
    }
  }
}
