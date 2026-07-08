import { Injectable, inject } from '@angular/core';

import type {
  LocalEventCheckoutBasketItemRecord,
  LocalEventCheckoutBasketRecord,
  LocalEventCheckoutBasketResultState,
  LocalEventCheckoutBasketStatePatchRecord,
  LocalEventCheckoutBasketStatus,
  LocalEventCheckoutLineItemRecord,
  LocalEventCheckoutPricingSummaryRowRecord
} from '../mappers';
import { LocalEventCheckoutBasketsMapper } from '../mappers';
import { AppMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

interface EventCheckoutBasketRecordCollection {
  byKey: Record<string, LocalEventCheckoutBasketRecord>;
  keys: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LocalEventCheckoutBasketsRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  async loadBasketByEvent(userId: string, sourceId: string): Promise<LocalEventCheckoutBasketRecord | null> {
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return null;
    }
    const table = await this.readTable();
    return this.activeBasket(table.byKey[key]);
  }

  async loadActiveItemsByEvent(
    sourceId: string,
    excludeUserId?: string | null
  ): Promise<LocalEventCheckoutBasketItemRecord[]> {
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

  async saveBasket(record: LocalEventCheckoutBasketRecord): Promise<LocalEventCheckoutBasketRecord | null> {
    const userId = record.userId?.trim() ?? '';
    const sourceId = record.sourceId?.trim() ?? '';
    const key = this.recordKey(userId, sourceId);
    if (!key) {
      return null;
    }
    const status = this.normalizeStatus(record.status);
    const currency = record.currency?.trim() || 'USD';
    const items = (record.items ?? [])
      .map(item => this.normalizeBasketItem({
        ...item,
        status: item?.status === 'pay' ? 'pay' : status,
        resultState: item?.resultState ?? 'pending'
      }, status, currency))
      .filter((item): item is LocalEventCheckoutBasketItemRecord => Boolean(item));
    const table = await this.readTable();
    const incomingItemIds = new Set(items.map(item => item.id));
    const updatedAtIso = new Date().toISOString();
    const inactiveExistingItems = (table.byKey[key]?.items ?? [])
      .filter(item => !this.isActiveItem(item));
    const deletedExistingItems = (table.byKey[key]?.items ?? [])
      .filter(item => this.isActiveItem(item) && !incomingItemIds.has(item.id))
      .map(item => this.normalizeBasketItem({
        ...item,
        status: 'deleted',
        resultState: 'deleted',
        updatedAtIso
      }, status, currency))
      .filter((item): item is LocalEventCheckoutBasketItemRecord => Boolean(item));
    const storedItems = [...inactiveExistingItems, ...deletedExistingItems, ...items];
    const activeItems = storedItems.filter(item => this.isActiveItem(item));
    const basket = LocalEventCheckoutBasketsMapper.cloneRecord({
      userId,
      sourceId,
      status,
      items: storedItems,
      pricingSummaryRows: this.aggregatePricingSummaryRows(activeItems),
      lineItems: this.lineItemsFromBasketItems(activeItems),
      totalAmount: this.totalAmountFromBasketItems(activeItems),
      currency,
      slotSourceId: record.slotSourceId ?? activeItems.find(item => item.slotSourceId?.trim())?.slotSourceId ?? null,
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

  async updateBasketState(
    request: LocalEventCheckoutBasketStatePatchRecord
  ): Promise<LocalEventCheckoutBasketRecord | null> {
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
    const basket = LocalEventCheckoutBasketsMapper.cloneRecord({
      ...current,
      status: checkoutState,
      checkoutSessionId: checkoutSessionId ?? current.checkoutSessionId ?? null,
      items: current.items.map(item => this.isActiveItem(item)
        ? {
            ...item,
            status: checkoutState,
            resultState: resultState ?? item.resultState ?? 'pending',
            checkoutSessionId: checkoutSessionId ?? item.checkoutSessionId ?? null,
            updatedAtIso
          }
        : item)
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
            .map(([key, basket]) => [key, LocalEventCheckoutBasketsMapper.cloneRecord(basket)])
            .filter((entry): entry is [string, LocalEventCheckoutBasketRecord] => Boolean(entry[1]))
        )
      : {};
    const keys = Array.isArray(entry?.keys)
      ? entry.keys.map(key => `${key ?? ''}`.trim()).filter(key => Boolean(byKey[key]))
      : Object.keys(byKey);
    return { byKey, keys };
  }

  private normalizeBasketItem(
    item: LocalEventCheckoutBasketItemRecord | null | undefined,
    fallbackStatus: LocalEventCheckoutBasketStatus,
    fallbackCurrency?: string | null
  ): LocalEventCheckoutBasketItemRecord | null {
    return LocalEventCheckoutBasketsMapper.cloneItemRecord(item, fallbackStatus, fallbackCurrency);
  }

  private activeBasket(
    basket: LocalEventCheckoutBasketRecord | null | undefined
  ): LocalEventCheckoutBasketRecord | null {
    const cloned = LocalEventCheckoutBasketsMapper.cloneRecord(basket);
    const activeItems = (cloned?.items ?? []).filter(item => this.isActiveItem(item));
    if (!cloned || activeItems.length === 0) {
      return null;
    }
    const currency = cloned.currency || activeItems.find(item => item.currency)?.currency || 'USD';
    return LocalEventCheckoutBasketsMapper.cloneRecord({
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

  private lineItemsFromBasketItems(
    items: readonly LocalEventCheckoutBasketItemRecord[]
  ): LocalEventCheckoutLineItemRecord[] {
    return items.map(item => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      amount: Math.round((Number(item.amount) || 0) * Math.max(1, Math.trunc(Number(item.quantity) || 1)) * 100) / 100,
      currency: item.currency || 'USD'
    })).filter(item => item.id && item.label);
  }

  private totalAmountFromBasketItems(items: readonly LocalEventCheckoutBasketItemRecord[]): number {
    return Math.round(this.lineItemsFromBasketItems(items)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * 100) / 100;
  }

  private aggregatePricingSummaryRows(
    items: readonly LocalEventCheckoutBasketItemRecord[]
  ): LocalEventCheckoutPricingSummaryRowRecord[] {
    const grouped = new Map<string, LocalEventCheckoutPricingSummaryRowRecord>();
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

  private normalizeStatus(value: unknown): LocalEventCheckoutBasketStatus {
    return LocalEventCheckoutBasketsMapper.normalizeStatus(value);
  }

  private normalizeResultState(value: unknown): LocalEventCheckoutBasketResultState {
    return LocalEventCheckoutBasketsMapper.normalizeResultState(value);
  }

  private isInactiveResultState(
    resultState: LocalEventCheckoutBasketResultState | string | null | undefined
  ): boolean {
    return LocalEventCheckoutBasketsMapper.isInactiveResultState(resultState);
  }

  private isActiveItem(item: LocalEventCheckoutBasketItemRecord): boolean {
    return `${item.status ?? ''}` !== 'deleted' && !this.isInactiveResultState(item.resultState);
  }

  private recordKey(userId: string, sourceId: string): string {
    return LocalEventCheckoutBasketsMapper.recordKey(userId, sourceId);
  }
}
