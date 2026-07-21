import type { AssetType } from '../../../common/constants';
import type {
  EventCheckoutBasket,
  EventCheckoutBasketItem,
  EventCheckoutLineItem,
  EventCheckoutPricingSummaryRow,
  EventCheckoutRequest,
  EventCheckoutResultState,
  EventCheckoutState,
  EventCheckoutStateChangeRequest
} from '../../../contracts/activity.interface';

export type LocalEventCheckoutBasketStatus = EventCheckoutState | 'deleted';
export type LocalEventCheckoutBasketResultState = EventCheckoutResultState;

export interface LocalEventCheckoutPricingSummaryRowRecord {
  key: string;
  label: string;
  detail?: string | null;
  amount?: number | null;
  currency?: string | null;
  multiplier?: number | null;
}

export interface LocalEventCheckoutLineItemRecord {
  id: string;
  kind: 'event' | 'sub_event' | 'resource';
  label: string;
  detail: string;
  amount: number;
  currency: string;
}

export interface LocalEventCheckoutBasketItemRecord {
  id: string;
  kind: 'event' | 'sub_event' | 'resource';
  sourceId: string;
  slotSourceId?: string | null;
  slotTemplateId?: string | null;
  selectedDateKey?: string | null;
  subEventId?: string | null;
  resourceType?: AssetType | null;
  label: string;
  detail: string;
  amount: number;
  currency: string;
  quantity: number;
  status: LocalEventCheckoutBasketStatus;
  resultState?: LocalEventCheckoutBasketResultState | null;
  pricingSummaryRows: LocalEventCheckoutPricingSummaryRowRecord[];
  checkoutSessionId?: string | null;
  createdAtIso?: string | null;
  updatedAtIso?: string | null;
  expiresAtIso?: string | null;
}

export interface LocalEventCheckoutBasketRecord {
  userId: string;
  sourceId: string;
  status: LocalEventCheckoutBasketStatus;
  items: LocalEventCheckoutBasketItemRecord[];
  pricingSummaryRows: LocalEventCheckoutPricingSummaryRowRecord[];
  lineItems: LocalEventCheckoutLineItemRecord[];
  totalAmount: number;
  currency: string;
  slotSourceId?: string | null;
  selectedDateKey?: string | null;
  checkoutSessionId?: string | null;
  expiresAtIso?: string | null;
  appliedPromoCodes: string[];
}

export interface LocalEventCheckoutBasketStatePatchRecord {
  userId: string;
  sourceId: string;
  checkoutState: LocalEventCheckoutBasketStatus;
  resultState?: LocalEventCheckoutBasketResultState | null;
  checkoutSessionId?: string | null;
}

export class LocalEventCheckoutBasketsMapper {
  static toRecordFromRequest(request: EventCheckoutRequest): LocalEventCheckoutBasketRecord | null {
    const userId = request.userId?.trim() ?? '';
    const sourceId = request.sourceId?.trim() ?? '';
    if (!userId || !sourceId) {
      return null;
    }
    const status = this.normalizeDtoStatus(request.checkoutState);
    const currency = request.currency?.trim() || 'USD';
    const items = (request.basketItems ?? [])
      .map(item => this.itemRecordFromDto({
        ...item,
        status: item?.status === 'pay' ? 'pay' : status,
        resultState: item?.resultState ?? 'pending'
      }, status, currency))
      .filter((item): item is LocalEventCheckoutBasketItemRecord => Boolean(item));
    return this.cloneRecord({
      userId,
      sourceId,
      status,
      items,
      pricingSummaryRows: this.pricingRowsToRecords(request.pricingSummaryRows, currency),
      lineItems: this.lineItemsToRecords(request.lineItems, currency),
      totalAmount: this.roundMoney(request.totalAmount),
      currency,
      slotSourceId: request.slotSourceId?.trim()
        || items.find(item => item.slotSourceId?.trim())?.slotSourceId
        || null,
      selectedDateKey: items.find(item => item.selectedDateKey?.trim())?.selectedDateKey ?? null,
      checkoutSessionId: items.find(item => item.checkoutSessionId?.trim())?.checkoutSessionId ?? null,
      expiresAtIso: items.find(item => item.expiresAtIso?.trim())?.expiresAtIso ?? null,
      appliedPromoCodes: this.normalizeAppliedPromoCodes(request.appliedPromoCodes)
    });
  }

  static toStatePatchRecord(
    request: Pick<EventCheckoutStateChangeRequest, 'userId' | 'sourceId' | 'checkoutState' | 'resultState' | 'checkoutSessionId'>
  ): LocalEventCheckoutBasketStatePatchRecord | null {
    const userId = request.userId?.trim() ?? '';
    const sourceId = request.sourceId?.trim() ?? '';
    if (!userId || !sourceId) {
      return null;
    }
    return {
      userId,
      sourceId,
      checkoutState: this.normalizeStatus(request.checkoutState),
      resultState: request.resultState == null
        ? null
        : this.normalizeResultState(request.resultState),
      checkoutSessionId: request.checkoutSessionId?.trim() || null
    };
  }

  static toRecord(dto: EventCheckoutBasket | null | undefined): LocalEventCheckoutBasketRecord | null {
    if (!dto) {
      return null;
    }
    const userId = dto.userId?.trim() ?? '';
    const sourceId = dto.sourceId?.trim() ?? '';
    if (!userId || !sourceId) {
      return null;
    }
    const currency = dto.currency?.trim() || 'USD';
    const status = this.normalizeStatus(dto.status);
    const items = (dto.items ?? [])
      .map(item => this.itemRecordFromDto(item, status, currency))
      .filter((item): item is LocalEventCheckoutBasketItemRecord => Boolean(item));
    return this.cloneRecord({
      userId,
      sourceId,
      status,
      items,
      pricingSummaryRows: this.pricingRowsToRecords(dto.pricingSummaryRows, currency),
      lineItems: this.lineItemsToRecords(dto.lineItems, currency),
      totalAmount: this.roundMoney(dto.totalAmount),
      currency,
      slotSourceId: dto.slotSourceId?.trim() || null,
      selectedDateKey: dto.selectedDateKey?.trim() || null,
      checkoutSessionId: dto.checkoutSessionId?.trim() || null,
      expiresAtIso: dto.expiresAtIso?.trim() || null,
      appliedPromoCodes: this.normalizeAppliedPromoCodes(dto.appliedPromoCodes)
    });
  }

  static toDto(record: LocalEventCheckoutBasketRecord | null | undefined): EventCheckoutBasket | null {
    const cloned = this.cloneRecord(record);
    if (!cloned) {
      return null;
    }
    return {
      userId: cloned.userId,
      sourceId: cloned.sourceId,
      status: this.normalizeDtoStatus(cloned.status),
      items: this.itemRecordsToDtos(cloned.items),
      pricingSummaryRows: cloned.pricingSummaryRows.map(row => this.pricingRowToDto(row, cloned.currency)),
      lineItems: cloned.lineItems.map(item => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        detail: item.detail,
        amount: item.amount,
        currency: item.currency || cloned.currency || 'USD'
      })),
      totalAmount: cloned.totalAmount,
      currency: cloned.currency || 'USD',
      slotSourceId: cloned.slotSourceId ?? null,
      selectedDateKey: cloned.selectedDateKey ?? null,
      checkoutSessionId: cloned.checkoutSessionId ?? null,
      expiresAtIso: cloned.expiresAtIso ?? null,
      appliedPromoCodes: [...cloned.appliedPromoCodes]
    };
  }

  static itemRecordsToDtos(records: readonly LocalEventCheckoutBasketItemRecord[]): EventCheckoutBasketItem[] {
    return (records ?? [])
      .map(record => this.itemRecordToDto(record))
      .filter((item): item is EventCheckoutBasketItem => Boolean(item));
  }

  static itemRecordToDto(record: LocalEventCheckoutBasketItemRecord | null | undefined): EventCheckoutBasketItem | null {
    const cloned = this.cloneItemRecord(record);
    if (!cloned) {
      return null;
    }
    return {
      id: cloned.id,
      kind: cloned.kind,
      sourceId: cloned.sourceId,
      slotSourceId: cloned.slotSourceId ?? null,
      slotTemplateId: cloned.slotTemplateId ?? null,
      selectedDateKey: cloned.selectedDateKey ?? null,
      subEventId: cloned.subEventId ?? null,
      resourceType: cloned.resourceType ?? null,
      label: cloned.label,
      detail: cloned.detail,
      amount: cloned.amount,
      currency: cloned.currency,
      quantity: cloned.quantity,
      status: this.normalizeDtoStatus(cloned.status),
      resultState: this.normalizeResultState(cloned.resultState),
      pricingSummaryRows: cloned.pricingSummaryRows.map(row => this.pricingRowToDto(row, cloned.currency)),
      checkoutSessionId: cloned.checkoutSessionId ?? null,
      createdAtIso: cloned.createdAtIso ?? null,
      updatedAtIso: cloned.updatedAtIso ?? null,
      expiresAtIso: cloned.expiresAtIso ?? null
    };
  }

  static cloneRecord(record: LocalEventCheckoutBasketRecord | null | undefined): LocalEventCheckoutBasketRecord | null {
    const userId = record?.userId?.trim() ?? '';
    const sourceId = record?.sourceId?.trim() ?? '';
    if (!userId || !sourceId) {
      return null;
    }
    const currency = record?.currency?.trim() || 'USD';
    const status = this.normalizeStatus(record?.status);
    return {
      userId,
      sourceId,
      status,
      items: (record?.items ?? [])
        .map(item => this.cloneItemRecord(item, status, currency))
        .filter((item): item is LocalEventCheckoutBasketItemRecord => Boolean(item)),
      pricingSummaryRows: this.pricingRowsToRecords(record?.pricingSummaryRows, currency),
      lineItems: this.lineItemsToRecords(record?.lineItems, currency),
      totalAmount: this.roundMoney(record?.totalAmount),
      currency,
      slotSourceId: record?.slotSourceId?.trim() || null,
      selectedDateKey: record?.selectedDateKey?.trim() || null,
      checkoutSessionId: record?.checkoutSessionId?.trim() || null,
      expiresAtIso: record?.expiresAtIso?.trim() || null,
      appliedPromoCodes: this.normalizeAppliedPromoCodes(record?.appliedPromoCodes)
    };
  }

  static cloneItemRecord(
    record: LocalEventCheckoutBasketItemRecord | null | undefined,
    fallbackStatus: LocalEventCheckoutBasketStatus = 'draft',
    fallbackCurrency?: string | null
  ): LocalEventCheckoutBasketItemRecord | null {
    const id = record?.id?.trim() ?? '';
    const sourceId = record?.sourceId?.trim() ?? '';
    const label = record?.label?.trim() ?? '';
    if (!id || !sourceId || !label) {
      return null;
    }
    const currency = record?.currency?.trim() || fallbackCurrency?.trim() || 'USD';
    return {
      id,
      kind: this.normalizeKind(record?.kind),
      sourceId,
      slotSourceId: record?.slotSourceId?.trim() || null,
      slotTemplateId: record?.slotTemplateId?.trim() || null,
      selectedDateKey: record?.selectedDateKey?.trim() || null,
      subEventId: record?.subEventId?.trim() || null,
      resourceType: record?.resourceType ?? null,
      label,
      detail: record?.detail?.trim() || '',
      amount: this.roundMoney(record?.amount),
      currency,
      quantity: Math.max(1, Math.trunc(Number(record?.quantity) || 1)),
      status: this.normalizeStatus(record?.status ?? fallbackStatus),
      resultState: this.normalizeResultState(record?.resultState),
      pricingSummaryRows: this.pricingRowsToRecords(record?.pricingSummaryRows, currency),
      checkoutSessionId: record?.checkoutSessionId?.trim() || null,
      createdAtIso: record?.createdAtIso?.trim() || null,
      updatedAtIso: record?.updatedAtIso?.trim() || null,
      expiresAtIso: record?.expiresAtIso?.trim() || null
    };
  }

  static normalizeStatus(value: unknown): LocalEventCheckoutBasketStatus {
    return value === 'confirmed'
      || value === 'waiting'
      || value === 'approval-pending'
      || value === 'approved'
      || value === 'pay'
      || value === 'cancelled'
      || value === 'rejected'
      || value === 'deleted'
        ? value
        : 'draft';
  }

  static normalizeDtoStatus(value: unknown): EventCheckoutState {
    const status = this.normalizeStatus(value);
    return status === 'deleted' ? 'draft' : status;
  }

  static normalizeResultState(value: unknown): LocalEventCheckoutBasketResultState {
    return value === 'deleted' || value === 'succeeded' || value === 'failed'
      ? value
      : 'pending';
  }

  static isInactiveResultState(resultState: LocalEventCheckoutBasketResultState | string | null | undefined): boolean {
    return resultState === 'deleted' || resultState === 'succeeded';
  }

  static isActiveStatus(status: LocalEventCheckoutBasketStatus | string | null | undefined): boolean {
    return status === 'draft'
      || status === 'confirmed'
      || status === 'waiting'
      || status === 'approval-pending'
      || status === 'approved'
      || status === 'pay';
  }

  static recordKey(userId: string, sourceId: string): string {
    const normalizedUserId = `${userId ?? ''}`.trim();
    const normalizedSourceId = `${sourceId ?? ''}`.trim();
    return normalizedUserId && normalizedSourceId ? `${normalizedUserId}::${normalizedSourceId}` : '';
  }

  private static itemRecordFromDto(
    item: EventCheckoutBasketItem | null | undefined,
    fallbackStatus: LocalEventCheckoutBasketStatus,
    fallbackCurrency?: string | null
  ): LocalEventCheckoutBasketItemRecord | null {
    if (!item) {
      return null;
    }
    return this.cloneItemRecord({
      id: item.id,
      kind: item.kind,
      sourceId: item.sourceId,
      slotSourceId: item.slotSourceId ?? null,
      slotTemplateId: item.slotTemplateId ?? null,
      selectedDateKey: item.selectedDateKey ?? null,
      subEventId: item.subEventId ?? null,
      resourceType: item.resourceType ?? null,
      label: item.label,
      detail: item.detail,
      amount: item.amount,
      currency: item.currency,
      quantity: item.quantity,
      status: this.normalizeStatus(item.status ?? fallbackStatus),
      resultState: this.normalizeResultState(item.resultState),
      pricingSummaryRows: this.pricingRowsToRecords(item.pricingSummaryRows, item.currency || fallbackCurrency),
      checkoutSessionId: item.checkoutSessionId ?? null,
      createdAtIso: item.createdAtIso ?? null,
      updatedAtIso: item.updatedAtIso ?? null,
      expiresAtIso: item.expiresAtIso ?? null
    }, fallbackStatus, fallbackCurrency);
  }

  private static pricingRowToDto(
    row: LocalEventCheckoutPricingSummaryRowRecord,
    fallbackCurrency?: string | null
  ): EventCheckoutPricingSummaryRow {
    return {
      key: row.key,
      label: row.label,
      detail: row.detail ?? null,
      amount: Number.isFinite(row.amount) ? Number(row.amount) : null,
      currency: row.currency?.trim() || fallbackCurrency?.trim() || 'USD',
      multiplier: Number.isFinite(row.multiplier) ? Math.max(1, Math.trunc(Number(row.multiplier))) : null
    };
  }

  private static pricingRowsToRecords(
    rows: readonly (LocalEventCheckoutPricingSummaryRowRecord | EventCheckoutPricingSummaryRow)[] | null | undefined,
    fallbackCurrency?: string | null
  ): LocalEventCheckoutPricingSummaryRowRecord[] {
    const currency = fallbackCurrency?.trim() || 'USD';
    return (rows ?? []).map(row => ({
      key: row.key?.trim() || row.label?.trim() || 'pricing',
      label: row.label?.trim() || 'Pricing',
      detail: row.detail?.trim() || null,
      amount: Number.isFinite(row.amount) ? this.roundMoney(Number(row.amount)) : null,
      currency: row.currency?.trim() || currency,
      multiplier: Number.isFinite(row.multiplier) ? Math.max(1, Math.trunc(Number(row.multiplier))) : null
    })).filter(row => row.label);
  }

  private static lineItemsToRecords(
    items: readonly (LocalEventCheckoutLineItemRecord | EventCheckoutLineItem)[] | null | undefined,
    fallbackCurrency?: string | null
  ): LocalEventCheckoutLineItemRecord[] {
    const currency = fallbackCurrency?.trim() || 'USD';
    return (items ?? []).map(item => ({
      id: item.id?.trim() ?? '',
      kind: this.normalizeKind(item.kind),
      label: item.label?.trim() ?? '',
      detail: item.detail?.trim() ?? '',
      amount: this.roundMoney(item.amount),
      currency: item.currency?.trim() || currency
    })).filter(item => item.id && item.label);
  }

  private static normalizeKind(value: unknown): 'event' | 'sub_event' | 'resource' {
    return value === 'sub_event' || value === 'resource' ? value : 'event';
  }

  private static normalizeAppliedPromoCodes(value: readonly string[] | null | undefined): string[] {
    return [...new Set((value ?? [])
      .map(code => `${code ?? ''}`.trim().toUpperCase())
      .filter(Boolean))];
  }

  private static roundMoney(value: unknown): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
