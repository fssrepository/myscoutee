import { Injectable, Type, signal } from '@angular/core';

import type {
  AssetAvailabilityFilter,
  AssetAvailabilityView,
  AssetRequestMetricsDTO
} from '../../../core/contracts/asset.interface';

export interface AssetAvailabilityPopupRequest {
  updatedMs: number;
  instanceId: string;
  assetId: string;
  ownerUserId: string;
  initialDateIso?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  filter: AssetAvailabilityFilter;
  view: AssetAvailabilityView;
  source?: 'asset-card' | 'calendar-cell' | null;
}

export interface AssetAvailabilityHeaderState {
  assetId: string;
  ownerUserId: string;
  title: string;
  subtitle?: string | null;
  type?: string | null;
  capacity: number;
  metrics?: AssetRequestMetricsDTO | null;
}

export type AssetAvailabilityPopupOpenRequest = {
  instanceId?: string | null;
  assetId: string;
  ownerUserId: string;
  initialDateIso?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  filter?: AssetAvailabilityFilter | null;
  view?: AssetAvailabilityView | null;
  source?: AssetAvailabilityPopupRequest['source'];
};

@Injectable({
  providedIn: 'root'
})
export class AssetAvailabilityPopupStore {
  private readonly availabilityPopupRef = signal<AssetAvailabilityPopupRequest | null>(null);
  private readonly dayListPopupRef = signal<AssetAvailabilityPopupRequest | null>(null);
  private readonly availabilityHeaderRef = signal<AssetAvailabilityHeaderState | null>(null);
  private readonly dayListHeaderRef = signal<AssetAvailabilityHeaderState | null>(null);
  private readonly assetAvailabilityPopupComponentRef = signal<Type<unknown> | null>(null);

  readonly availabilityPopup = this.availabilityPopupRef.asReadonly();
  readonly dayListPopup = this.dayListPopupRef.asReadonly();
  readonly availabilityHeader = this.availabilityHeaderRef.asReadonly();
  readonly dayListHeader = this.dayListHeaderRef.asReadonly();
  readonly assetAvailabilityPopupComponent = this.assetAvailabilityPopupComponentRef.asReadonly();

  openAvailabilityPopup(
    request: AssetAvailabilityPopupOpenRequest,
    header?: AssetAvailabilityHeaderState | null
  ): void {
    const normalized = this.normalizeRequest(request, 'asset-availability', 'day');
    if (!normalized) {
      return;
    }
    this.availabilityPopupRef.set(normalized);
    this.availabilityHeaderRef.set(this.normalizeHeader(header, normalized));
  }

  openDayListPopup(
    request: AssetAvailabilityPopupOpenRequest,
    header?: AssetAvailabilityHeaderState | null
  ): void {
    const normalized = this.normalizeRequest(request, 'asset-availability-day-list', 'day');
    if (!normalized) {
      return;
    }
    this.dayListPopupRef.set({
      ...normalized,
      view: 'day'
    });
    this.dayListHeaderRef.set(this.normalizeHeader(header, normalized) ?? this.availabilityHeaderRef());
  }

  closeAvailabilityPopup(): void {
    this.availabilityPopupRef.set(null);
    this.availabilityHeaderRef.set(null);
  }

  closeDayListPopup(): void {
    this.dayListPopupRef.set(null);
    this.dayListHeaderRef.set(null);
  }

  patchRequestMetrics(delta: Partial<Record<keyof AssetRequestMetricsDTO, number>>): void {
    const patchHeader = (header: AssetAvailabilityHeaderState | null): AssetAvailabilityHeaderState | null => {
      if (!header?.metrics) {
        return header;
      }
      const metrics = { ...header.metrics };
      for (const [key, value] of Object.entries(delta) as Array<[keyof AssetRequestMetricsDTO, number]>) {
        metrics[key] = this.normalizeCount(metrics[key] + (Number(value) || 0));
      }
      return { ...header, metrics };
    };
    this.availabilityHeaderRef.update(patchHeader);
    this.dayListHeaderRef.update(patchHeader);
  }

  updateDayListRange(
    rangeStart: string | null,
    rangeEnd: string | null,
    filter?: AssetAvailabilityFilter | null
  ): void {
    const request = this.dayListPopupRef();
    if (!request) {
      return;
    }
    const normalizedStart = `${rangeStart ?? ''}`.trim() || null;
    const normalizedEnd = `${rangeEnd ?? ''}`.trim() || null;
    this.dayListPopupRef.set({
      ...request,
      updatedMs: Date.now(),
      initialDateIso: normalizedStart ?? request.initialDateIso ?? null,
      rangeStart: normalizedStart,
      rangeEnd: normalizedEnd,
      filter: this.normalizeFilter(filter ?? request.filter)
    });
  }

  async ensureAssetAvailabilityPopupLoaded(): Promise<void> {
    if (this.assetAvailabilityPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../asset/components/asset-availability-popup/asset-availability-popup.component');
    this.assetAvailabilityPopupComponentRef.set(module.AssetAvailabilityPopupComponent);
  }

  private normalizeRequest(
    request: AssetAvailabilityPopupOpenRequest,
    fallbackInstanceId: string,
    fallbackView: AssetAvailabilityView
  ): AssetAvailabilityPopupRequest | null {
    const assetId = `${request.assetId ?? ''}`.trim();
    const ownerUserId = `${request.ownerUserId ?? ''}`.trim();
    if (!assetId || !ownerUserId) {
      return null;
    }
    const view = this.normalizeView(request.view, fallbackView);
    return {
      updatedMs: Date.now(),
      instanceId: `${request.instanceId ?? ''}`.trim() || `${fallbackInstanceId}:${assetId}`,
      assetId,
      ownerUserId,
      initialDateIso: `${request.initialDateIso ?? ''}`.trim() || null,
      rangeStart: `${request.rangeStart ?? ''}`.trim() || null,
      rangeEnd: `${request.rangeEnd ?? ''}`.trim() || null,
      filter: this.normalizeFilter(request.filter),
      view,
      source: request.source ?? null
    };
  }

  private normalizeHeader(
    header: AssetAvailabilityHeaderState | null | undefined,
    request: AssetAvailabilityPopupRequest
  ): AssetAvailabilityHeaderState | null {
    const assetId = `${header?.assetId ?? request.assetId}`.trim();
    const ownerUserId = `${header?.ownerUserId ?? request.ownerUserId}`.trim();
    const title = `${header?.title ?? ''}`.trim();
    if (!assetId || !ownerUserId || !title) {
      return null;
    }
    return {
      assetId,
      ownerUserId,
      title,
      subtitle: `${header?.subtitle ?? ''}`.trim() || null,
      type: `${header?.type ?? ''}`.trim() || null,
      capacity: Math.max(0, Math.trunc(Number(header?.capacity) || 0)),
      metrics: this.normalizeMetrics(header?.metrics)
    };
  }

  private normalizeMetrics(metrics: AssetRequestMetricsDTO | null | undefined): AssetRequestMetricsDTO | null {
    if (!metrics) {
      return null;
    }
    return {
      allItems: this.normalizeCount(metrics.allItems),
      activeItems: this.normalizeCount(metrics.activeItems),
      assignedItems: this.normalizeCount(metrics.assignedItems),
      borrowedItems: this.normalizeCount(metrics.borrowedItems),
      pendingItems: this.normalizeCount(metrics.pendingItems)
    };
  }

  private normalizeCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  }

  private normalizeFilter(filter: AssetAvailabilityFilter | null | undefined): AssetAvailabilityFilter {
    if (filter === 'active-items' || filter === 'pending-requests' || filter === 'borrowed-items') {
      return filter;
    }
    return 'all';
  }

  private normalizeView(
    view: AssetAvailabilityView | null | undefined,
    fallback: AssetAvailabilityView
  ): AssetAvailabilityView {
    return view === 'day' || view === 'week' || view === 'month' ? view : fallback;
  }
}
