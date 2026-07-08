import { Injectable, inject } from '@angular/core';

import { ActivityEventDetailDTO } from '../../../contracts/activity.interface';
import type {
  EventCheckoutBasket,
  EventCheckoutBasketItem,
  EventCheckoutLineItem,
  EventCheckoutPricingSummaryRow,
  EventCheckoutRequest,
  EventCheckoutResultState,
  EventCheckoutState
} from '../../../contracts/activity.interface';
import { AppMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

interface EventCheckoutBasketRecordCollection {
  byKey: Record<string, EventCheckoutBasket>;
  keys: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LocalEventCheckoutBasketsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async loadBasketByEvent(userId: string, sourceId: string): Promise<EventCheckoutBasket | null> {
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return null;
    }
    const table = await this.readTable();
    return this.activeBasket(table.byKey[key]);
  }

  async loadActiveItemsByEvent(sourceId: string, excludeUserId?: string | null): Promise<EventCheckoutBasketItem[]> {
    const normalizedSourceId = `${sourceId ?? ''}`.trim();
    if (!normalizedSourceId) {
      return [];
    }
    const normalizedExcludeUserId = `${excludeUserId ?? ''}`.trim();
    const table = await this.readTable();
    return Object.values(table.byKey)
      .filter(basket => basket?.sourceId === normalizedSourceId)
      .filter(basket => !normalizedExcludeUserId || basket.userId !== normalizedExcludeUserId)
      .flatMap(basket => basket.items ?? [])
      .filter(item => this.isActiveItem(item));
  }

  async saveBasket(request: EventCheckoutRequest): Promise<EventCheckoutBasket | null> {
    const userId = request.userId?.trim() ?? '';
    const sourceId = request.sourceId?.trim() ?? '';
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return null;
    }
    const status = this.normalizeStatus(request.checkoutState);
    const items = (request.basketItems ?? [])
      .map(item => this.normalizeBasketItem({
        ...item,
        status: item?.status === 'pay' ? 'pay' : status,
        resultState: item?.resultState ?? 'pending'
      }, status, request.currency))
      .filter((item): item is EventCheckoutBasketItem => Boolean(item));
    const table = await this.readTable();
    const incomingItemIds = new Set(items.map(item => item.id));
    const deletedExistingItems = (table.byKey[key]?.items ?? [])
      .filter(item => this.isActiveItem(item) && !incomingItemIds.has(item.id))
      .map(item => this.normalizeBasketItem({ ...item, resultState: 'deleted' }, status, request.currency))
      .filter((item): item is EventCheckoutBasketItem => Boolean(item));
    const storedItems = [...deletedExistingItems, ...items];
    const activeItems = storedItems.filter(item => this.isActiveItem(item));
    const basket = ActivityEventDetailDTO.cloneCheckoutBasket({
      userId,
      sourceId,
      status,
      items: storedItems,
      pricingSummaryRows: this.aggregatePricingSummaryRows(activeItems),
      lineItems: this.lineItemsFromBasketItems(activeItems),
      totalAmount: this.totalAmountFromBasketItems(activeItems),
      currency: request.currency?.trim() || 'USD',
      slotSourceId: request.slotSourceId ?? activeItems.find(item => item.slotSourceId?.trim())?.slotSourceId ?? null,
      selectedDateKey: activeItems.find(item => item.selectedDateKey?.trim())?.selectedDateKey ?? null,
      checkoutSessionId: activeItems.find(item => item.checkoutSessionId?.trim())?.checkoutSessionId ?? null,
      expiresAtIso: activeItems.find(item => item.expiresAtIso?.trim())?.expiresAtIso ?? null
    });
    if (!basket) {
      return null;
    }
    const byKey = {
      ...table.byKey,
      [key]: basket
    };
    const keys = table.keys.includes(key) ? [...table.keys] : [...table.keys, key];
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.eventCheckoutBaskets, { byKey, keys });
    return this.activeBasket(basket);
  }

  async updateBasketState(request: {
    userId: string;
    sourceId: string;
    checkoutState: EventCheckoutState;
    resultState?: EventCheckoutResultState | null;
    checkoutSessionId?: string | null;
  }): Promise<EventCheckoutBasket | null> {
    const userId = request.userId?.trim() ?? '';
    const sourceId = request.sourceId?.trim() ?? '';
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return null;
    }
    const table = await this.readTable();
    const current = table.byKey[key];
    if (!current) {
      return null;
    }
    const checkoutState = this.normalizeStatus(request.checkoutState);
    const resultState = request.resultState == null
      ? null
      : this.normalizeResultState(request.resultState);
    const checkoutSessionId = request.checkoutSessionId?.trim() || null;
    const updatedAtIso = new Date().toISOString();
    const basket = ActivityEventDetailDTO.cloneCheckoutBasket({
      ...current,
      status: checkoutState,
      checkoutSessionId: checkoutSessionId ?? current.checkoutSessionId ?? null,
      items: current.items.map(item => ({
        ...item,
        status: checkoutState,
        resultState: resultState ?? item.resultState ?? 'pending',
        checkoutSessionId: checkoutSessionId ?? item.checkoutSessionId ?? null,
        updatedAtIso
      }))
    });
    if (!basket) {
      return null;
    }
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.eventCheckoutBaskets, {
      byKey: {
        ...table.byKey,
        [key]: basket
      },
      keys: table.keys.includes(key) ? table.keys : [...table.keys, key]
    });
    return this.activeBasket(basket);
  }

  async clearBasket(userId: string, sourceId: string): Promise<void> {
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return;
    }
    const table = await this.readTable();
    if (!table.byKey[key]) {
      return;
    }
    const byKey = { ...table.byKey };
    delete byKey[key];
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.eventCheckoutBaskets, {
      byKey,
      keys: table.keys.filter(item => item !== key)
    });
  }

  private async readTable(): Promise<EventCheckoutBasketRecordCollection> {
    await this.memoryDb.whenReady();
    const entry = await this.memoryDb.readIndexedDbTableEntry<EventCheckoutBasketRecordCollection>(
      APP_INDEXED_DB_KEYS.eventCheckoutBaskets
    );
    const byKey = entry?.byKey && typeof entry.byKey === 'object'
      ? Object.fromEntries(
          Object.entries(entry.byKey)
            .map(([key, basket]) => [key, ActivityEventDetailDTO.cloneCheckoutBasket(basket)])
            .filter((entry): entry is [string, EventCheckoutBasket] => Boolean(entry[1]))
        )
      : {};
    const keys = Array.isArray(entry?.keys)
      ? entry.keys.map(key => `${key ?? ''}`.trim()).filter(key => Boolean(byKey[key]))
      : Object.keys(byKey);
    return { byKey, keys };
  }

  private normalizeBasketItem(
    item: EventCheckoutBasketItem | null | undefined,
    fallbackStatus: EventCheckoutState,
    fallbackCurrency?: string | null
  ): EventCheckoutBasketItem | null {
    const id = item?.id?.trim() ?? '';
    const sourceId = item?.sourceId?.trim() ?? '';
    const label = item?.label?.trim() ?? '';
    if (!id || !sourceId || !label) {
      return null;
    }
    const currency = item?.currency?.trim() || fallbackCurrency?.trim() || 'USD';
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
      amount: Math.round((Number(item?.amount) || 0) * 100) / 100,
      currency,
      quantity: Math.max(1, Math.trunc(Number(item?.quantity) || 1)),
      status: this.normalizeStatus(item?.status ?? fallbackStatus),
      resultState: this.normalizeResultState(item?.resultState),
      pricingSummaryRows: this.normalizePricingSummaryRows(item?.pricingSummaryRows, currency),
      checkoutSessionId: item?.checkoutSessionId?.trim() || null,
      createdAtIso: item?.createdAtIso?.trim() || null,
      updatedAtIso: item?.updatedAtIso?.trim() || null,
      expiresAtIso: item?.expiresAtIso?.trim() || null
    };
  }

  private activeBasket(basket: EventCheckoutBasket | null | undefined): EventCheckoutBasket | null {
    const cloned = ActivityEventDetailDTO.cloneCheckoutBasket(basket);
    const activeItems = (cloned?.items ?? []).filter(item => this.isActiveItem(item));
    if (!cloned || activeItems.length === 0) {
      return null;
    }
    const currency = cloned.currency || activeItems.find(item => item.currency)?.currency || 'USD';
    return ActivityEventDetailDTO.cloneCheckoutBasket({
      ...cloned,
      status: activeItems.some(item => item.status === 'pay')
        ? 'pay'
        : activeItems.some(item => item.status === 'approved')
          ? 'approved'
          : activeItems.some(item => item.status === 'approval-pending')
            ? 'approval-pending'
            : activeItems.some(item => item.status === 'waiting')
              ? 'waiting'
              : activeItems.some(item => item.status === 'confirmed')
                ? 'confirmed'
                : 'draft',
      items: activeItems,
      pricingSummaryRows: this.aggregatePricingSummaryRows(activeItems),
      lineItems: this.lineItemsFromBasketItems(activeItems),
      totalAmount: this.totalAmountFromBasketItems(activeItems),
      currency,
      slotSourceId: activeItems.find(item => item.slotSourceId?.trim())?.slotSourceId ?? null,
      selectedDateKey: activeItems.find(item => item.selectedDateKey?.trim())?.selectedDateKey ?? null,
      checkoutSessionId: activeItems.find(item => item.checkoutSessionId?.trim())?.checkoutSessionId ?? null,
      expiresAtIso: activeItems.find(item => item.expiresAtIso?.trim())?.expiresAtIso ?? null
    });
  }

  private lineItemsFromBasketItems(items: readonly EventCheckoutBasketItem[]): EventCheckoutLineItem[] {
    return items.map(item => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      amount: Math.round((Number(item.amount) || 0) * Math.max(1, Math.trunc(Number(item.quantity) || 1)) * 100) / 100,
      currency: item.currency || 'USD'
    })).filter(item => item.id && item.label);
  }

  private totalAmountFromBasketItems(items: readonly EventCheckoutBasketItem[]): number {
    return Math.round(this.lineItemsFromBasketItems(items)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
  }

  private aggregatePricingSummaryRows(
    items: readonly EventCheckoutBasketItem[]
  ): EventCheckoutPricingSummaryRow[] {
    const grouped = new Map<string, EventCheckoutPricingSummaryRow>();
    for (const item of items) {
      const fallbackCurrency = item.currency?.trim() || 'USD';
      for (const row of item.pricingSummaryRows ?? []) {
        const label = row.label?.trim() || '';
        if (!label) {
          continue;
        }
        const detail = row.detail?.trim() || '';
        const amount = Number.isFinite(row.amount) ? Number(row.amount) : null;
        const currency = row.currency?.trim() || fallbackCurrency;
        const key = `${row.key?.trim() || label}::${detail}::${amount === null ? 'none' : amount}::${currency}`;
        const multiplier = Math.max(1, Math.trunc(Number(row.multiplier) || 1));
        const existing = grouped.get(key);
        if (existing) {
          const nextMultiplier = Math.max(1, Math.trunc(Number(existing.multiplier) || 1)) + multiplier;
          grouped.set(key, {
            ...existing,
            multiplier: nextMultiplier,
            amount: existing.amount !== null && amount !== null
              ? Math.round((Number(existing.amount) + (amount * multiplier)) * 100) / 100
              : existing.amount ?? amount
          });
          continue;
        }
        grouped.set(key, {
          key,
          label,
          detail: detail || null,
          amount: amount === null ? null : Math.round(amount * multiplier * 100) / 100,
          currency,
          multiplier
        });
      }
    }
    return [...grouped.values()];
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

  private normalizeStatus(value: unknown): EventCheckoutState {
    return value === 'confirmed'
      || value === 'waiting'
      || value === 'approval-pending'
      || value === 'approved'
      || value === 'pay'
      || value === 'cancelled'
      || value === 'rejected'
        ? value
        : 'draft';
  }

  private normalizeResultState(value: unknown): EventCheckoutResultState {
    return value === 'deleted' || value === 'succeeded' || value === 'failed'
      ? value
      : 'pending';
  }

  private isInactiveResultState(resultState: EventCheckoutResultState | string | null | undefined): boolean {
    return resultState === 'deleted' || resultState === 'succeeded';
  }

  private isActiveItem(item: EventCheckoutBasketItem): boolean {
    return `${item.status ?? ''}` !== 'deleted' && !this.isInactiveResultState(item.resultState);
  }

  private recordKey(userId: string, sourceId: string): string {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedSourceId = `${sourceId ?? ''}`.trim();
    return normalizedUserId && normalizedSourceId ? `${normalizedUserId}::${normalizedSourceId}` : '';
  }
}
