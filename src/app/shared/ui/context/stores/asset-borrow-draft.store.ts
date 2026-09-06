import { Injectable, signal } from '@angular/core';

import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';
import type { SavedPaymentMethodDto } from '../../../core/contracts/payment-method.interface';

export interface AssetBorrowDraft {
  userId: string;
  subEventId: string;
  cardId: string;
  ownerUserId: string;
  title: string;
  quantity: number;
  startAtIso: string;
  endAtIso: string;
  acceptedPolicyIds: string[];
  checkoutSessionId: string | null;
  paymentMethod: SavedPaymentMethodDto | null;
  paymentStep: boolean;
  updatedAtMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class AssetBorrowDraftStore {
  private static readonly STORAGE_KEY = APP_STORAGE_KEYS.assetBorrowDrafts;
  private readonly draftsRef = signal<Record<string, AssetBorrowDraft>>(this.readInitialDrafts());

  readonly drafts = this.draftsRef.asReadonly();

  list(userId: string, subEventId: string): AssetBorrowDraft[] {
    const normalizedUserId = userId.trim();
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedUserId || !normalizedSubEventId) {
      return [];
    }
    return Object.values(this.draftsRef())
      .filter(draft => draft.userId === normalizedUserId && draft.subEventId === normalizedSubEventId)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  read(userId: string, subEventId: string, cardId: string): AssetBorrowDraft | null {
    return this.draftsRef()[this.buildKey(userId, subEventId, cardId)] ?? null;
  }

  save(draft: AssetBorrowDraft): void {
    const normalized = this.normalizeDraft(draft);
    if (!normalized) {
      return;
    }
    const next = {
      ...this.draftsRef(),
      [this.buildKey(normalized.userId, normalized.subEventId, normalized.cardId)]: normalized
    };
    this.draftsRef.set(next);
    this.persist(next);
  }

  clear(userId: string, subEventId: string, cardId: string): void {
    const key = this.buildKey(userId, subEventId, cardId);
    const current = this.draftsRef();
    if (!current[key]) {
      return;
    }
    const next = { ...current };
    delete next[key];
    this.draftsRef.set(next);
    this.persist(next);
  }

  private buildKey(userId: string, subEventId: string, cardId: string): string {
    return `${userId.trim()}::${subEventId.trim()}::${cardId.trim()}`;
  }

  private normalizeDraft(draft: AssetBorrowDraft | null | undefined): AssetBorrowDraft | null {
    const userId = draft?.userId?.trim() ?? '';
    const subEventId = draft?.subEventId?.trim() ?? '';
    const cardId = draft?.cardId?.trim() ?? '';
    const ownerUserId = draft?.ownerUserId?.trim() ?? '';
    if (!userId || !subEventId || !cardId || !ownerUserId) {
      return null;
    }
    const paymentMethodId = draft?.paymentMethod?.id?.trim() ?? '';
    return {
      userId,
      subEventId,
      cardId,
      ownerUserId,
      title: draft?.title?.trim() || 'Borrow draft',
      quantity: Math.max(1, Math.trunc(Number(draft?.quantity) || 1)),
      startAtIso: draft?.startAtIso?.trim() || '',
      endAtIso: draft?.endAtIso?.trim() || '',
      acceptedPolicyIds: [...new Set(draft?.acceptedPolicyIds ?? [])]
        .map(item => item.trim())
        .filter(Boolean),
      checkoutSessionId: draft?.checkoutSessionId?.trim() || null,
      paymentMethod: paymentMethodId && draft?.paymentMethod
        ? { ...draft.paymentMethod, id: paymentMethodId }
        : null,
      paymentStep: draft?.paymentStep === true,
      updatedAtMs: Math.max(0, Math.trunc(Number(draft?.updatedAtMs) || Date.now()))
    };
  }

  private readInitialDrafts(): Record<string, AssetBorrowDraft> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(AssetBorrowDraftStore.STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, AssetBorrowDraft>;
      const next: Record<string, AssetBorrowDraft> = {};
      for (const value of Object.values(parsed ?? {})) {
        const normalized = this.normalizeDraft(value);
        if (normalized) {
          next[this.buildKey(normalized.userId, normalized.subEventId, normalized.cardId)] = normalized;
        }
      }
      return next;
    } catch {
      return {};
    }
  }

  private persist(drafts: Record<string, AssetBorrowDraft>): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(AssetBorrowDraftStore.STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // A storage quota/privacy failure keeps the current in-memory draft usable.
    }
  }
}
