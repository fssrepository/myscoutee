import { Injectable, signal } from '@angular/core';

import type {
  EventCheckoutBasketItem,
  EventCheckoutLineItem,
  EventCheckoutPricingSummaryRow,
  EventCheckoutResultState,
  EventCheckoutState
} from '../../../core/contracts/activity.interface';
import type { ActivityPendingReason } from '../../../core/common/constants';
import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';

export interface EventCheckoutDraft {
  userId: string;
  sourceId: string;
  eventTitle: string;
  eventTimeframe: string;
  slotSourceId: string | null;
  selectedDateKey: string | null;
  optionalSubEventIds: string[];
  acceptedPolicyIds: string[];
  basketItems: EventCheckoutBasketItem[];
  pricingSummaryRows: EventCheckoutPricingSummaryRow[];
  checkoutState: EventCheckoutState;
  lineItems: EventCheckoutLineItem[];
  totalAmount: number;
  currency: string;
  checkoutSessionId: string | null;
  expiresAtIso: string | null;
  pendingReason: ActivityPendingReason;
  updatedAtMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventCheckoutDraftStore {
  private static readonly STORAGE_KEY = APP_STORAGE_KEYS.eventCheckoutDrafts;
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
      basketItems: (draft?.basketItems ?? []).map(item => this.normalizeBasketItem(item)).filter(Boolean) as EventCheckoutBasketItem[],
      pricingSummaryRows: this.normalizePricingSummaryRows(
        (draft?.pricingSummaryRows ?? []).length > 0
          ? draft?.pricingSummaryRows
          : (draft?.basketItems ?? []).flatMap(item => item.pricingSummaryRows ?? []),
        draft?.currency
      ),
      checkoutState: this.normalizeCheckoutState(draft?.checkoutState),
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
      expiresAtIso: draft?.expiresAtIso?.trim() || null,
      pendingReason: draft?.pendingReason === 'waitlist'
        ? 'waitlist'
        : draft?.pendingReason === 'approval'
          ? 'approval'
          : null,
      updatedAtMs: Math.max(0, Math.trunc(Number(draft?.updatedAtMs) || Date.now()))
    };
  }

  private normalizeBasketItem(item: EventCheckoutBasketItem | null | undefined): EventCheckoutBasketItem | null {
    const id = item?.id?.trim() ?? '';
    const sourceId = item?.sourceId?.trim() ?? '';
    const label = item?.label?.trim() ?? '';
    if (!id || !sourceId || !label) {
      return null;
    }
    const currency = item?.currency?.trim() || 'USD';
    return {
      id,
      kind: item?.kind === 'sub_event' || item?.kind === 'resource' ? item.kind : 'event',
      sourceId,
      slotSourceId: item?.slotSourceId?.trim() || null,
      slotTemplateId: item?.slotTemplateId?.trim() || null,
      selectedDateKey: item?.selectedDateKey?.trim() || null,
      subEventId: item?.subEventId?.trim() || null,
      resourceType: item?.resourceType ?? null,
      label,
      detail: item?.detail?.trim() || '',
      amount: Number(item?.amount) || 0,
      currency,
      quantity: Math.max(1, Math.trunc(Number(item?.quantity) || 1)),
      status: this.normalizeCheckoutState(item?.status),
      resultState: this.normalizeCheckoutResultState(item?.resultState),
      pricingSummaryRows: (item?.pricingSummaryRows ?? []).map(row => ({
        key: row.key?.trim() || row.label?.trim() || 'pricing',
        label: row.label?.trim() || 'Pricing',
        detail: row.detail?.trim() || null,
        amount: Number.isFinite(row.amount) ? Number(row.amount) : null,
        currency: row.currency?.trim() || currency,
        multiplier: Number.isFinite(row.multiplier) ? Math.max(1, Math.trunc(Number(row.multiplier))) : null
      })).filter(row => row.label),
      checkoutSessionId: item?.checkoutSessionId?.trim() || null,
      createdAtIso: item?.createdAtIso?.trim() || null,
      updatedAtIso: item?.updatedAtIso?.trim() || null,
      expiresAtIso: item?.expiresAtIso?.trim() || null
    };
  }

  private normalizePricingSummaryRows(
    rows: readonly EventCheckoutPricingSummaryRow[] | null | undefined,
    fallbackCurrency?: string | null
  ): EventCheckoutPricingSummaryRow[] {
    const currency = fallbackCurrency?.trim() || 'USD';
    return (rows ?? []).map(row => ({
      key: row.key?.trim() || row.label?.trim() || 'pricing',
      label: row.label?.trim() || 'Pricing',
      detail: row.detail?.trim() || null,
      amount: Number.isFinite(row.amount) ? Number(row.amount) : null,
      currency: row.currency?.trim() || currency,
      multiplier: Number.isFinite(row.multiplier) ? Math.max(1, Math.trunc(Number(row.multiplier))) : null
    })).filter(row => row.label);
  }

  private normalizeCheckoutState(value: unknown): EventCheckoutState {
    return value === 'confirmed'
      || value === 'approval-pending'
      || value === 'approved'
      || value === 'pay'
      || value === 'cancelled'
      || value === 'rejected'
      || value === 'deleted'
        ? value
        : 'draft';
  }

  private normalizeCheckoutResultState(value: unknown): EventCheckoutResultState {
    return value === 'deleted' || value === 'succeeded' || value === 'failed' ? value : 'active';
  }

  private readInitialDrafts(): Record<string, EventCheckoutDraft> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(EventCheckoutDraftStore.STORAGE_KEY);
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
      window.localStorage.setItem(EventCheckoutDraftStore.STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore storage write failures.
    }
  }
}
