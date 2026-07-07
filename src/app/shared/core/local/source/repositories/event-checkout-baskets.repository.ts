import { Injectable, inject } from '@angular/core';

import { ActivityEventDetailDTO } from '../../../contracts/activity.interface';
import type {
  EventCheckoutBasket,
  EventCheckoutBasketItem,
  EventCheckoutLineItem,
  EventCheckoutPricingSummaryRow,
  EventCheckoutRequest,
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
    return ActivityEventDetailDTO.cloneCheckoutBasket(table.byKey[key]);
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
      .map(item => this.normalizeBasketItem(item, status, request.currency))
      .filter((item): item is EventCheckoutBasketItem => Boolean(item));
    const basket = ActivityEventDetailDTO.cloneCheckoutBasket({
      userId,
      sourceId,
      status,
      items,
      pricingSummaryRows: this.normalizePricingSummaryRows(request.pricingSummaryRows, request.currency),
      lineItems: this.normalizeLineItems(request.lineItems),
      totalAmount: Math.max(0, Number(request.totalAmount) || 0),
      currency: request.currency?.trim() || 'USD',
      slotSourceId: request.slotSourceId ?? items.find(item => item.slotSourceId?.trim())?.slotSourceId ?? null,
      selectedDateKey: items.find(item => item.selectedDateKey?.trim())?.selectedDateKey ?? null,
      checkoutSessionId: items.find(item => item.checkoutSessionId?.trim())?.checkoutSessionId ?? null,
      expiresAtIso: items.find(item => item.expiresAtIso?.trim())?.expiresAtIso ?? null
    });
    if (!basket) {
      return null;
    }
    const table = await this.readTable();
    const byKey = {
      ...table.byKey,
      [key]: basket
    };
    const keys = table.keys.includes(key) ? [...table.keys] : [...table.keys, key];
    await this.memoryDb.writeIndexedDbTableEntry(APP_INDEXED_DB_KEYS.eventCheckoutBaskets, { byKey, keys });
    return ActivityEventDetailDTO.cloneCheckoutBasket(basket);
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
      pricingSummaryRows: this.normalizePricingSummaryRows(item?.pricingSummaryRows, currency),
      checkoutSessionId: item?.checkoutSessionId?.trim() || null,
      createdAtIso: item?.createdAtIso?.trim() || null,
      updatedAtIso: item?.updatedAtIso?.trim() || null,
      expiresAtIso: item?.expiresAtIso?.trim() || null
    };
  }

  private normalizeLineItems(
    lineItems: readonly EventCheckoutLineItem[] | null | undefined
  ): EventCheckoutLineItem[] {
    return (lineItems ?? []).map(item => ({
      id: item.id?.trim() ?? '',
      kind: item.kind,
      label: item.label?.trim() ?? '',
      detail: item.detail?.trim() ?? '',
      amount: Math.round((Number(item.amount) || 0) * 100) / 100,
      currency: item.currency?.trim() || 'USD'
    })).filter(item => item.id && item.label);
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
    return value === 'confirmed' || value === 'pay' || value === 'deleted' ? value : 'draft';
  }

  private recordKey(userId: string, sourceId: string): string {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedSourceId = `${sourceId ?? ''}`.trim();
    return normalizedUserId && normalizedSourceId ? `${normalizedUserId}::${normalizedSourceId}` : '';
  }
}
