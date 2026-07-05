import type { AssetOccupancyRowDTO } from '../../core/contracts/asset.interface';
import type { SingleRowData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface AssetAvailabilitySingleRowConverterOptions {
  groupLabel?: string | null;
  translate?: (key: string, fallback?: string) => string;
}

export class AssetAvailabilitySingleRowConverter {
  static convert(
    row: AssetOccupancyRowDTO,
    options: AssetAvailabilitySingleRowConverterOptions = {}
  ): SingleRowData<AssetOccupancyRowDTO> {
    const status = this.statusLabel(row, options);
    const quantityValue = Math.max(1, Math.trunc(Number(row.quantity) || 1));
    const schedule = `${row.scheduleLabel ?? ''}`.trim();
    const badges = [{
      label: `${status}: ${quantityValue}`,
      tone: this.statusBadgeTone(row),
      position: 'top-right' as const
    }];
    return {
      id: row.id,
      smartListKey: `asset-availability:${row.assetId}:${row.id}`,
      ownerUserId: row.ownerUserId,
      ownerId: row.assetId,
      status: row.status,
      dateIso: row.startAtIso ?? row.dateIso,
      title: row.title || 'Request',
      subtitle: row.subtitle ?? null,
      detail: row.detail || schedule || null,
      groupLabel: options.groupLabel ?? null,
      avatarInitials: row.avatarInitials ?? null,
      avatarUrl: row.avatarUrl ?? null,
      avatarToneClass: `user-color-${row.gender}`,
      surfaceTone: this.surfaceTone(row),
      badges,
      metaRows: schedule && row.detail ? [schedule] : [],
      menuActions: row.menuActions ?? [],
      eagerDetail: row
    };
  }

  static convertList(
    rows: readonly AssetOccupancyRowDTO[],
    options: AssetAvailabilitySingleRowConverterOptions = {}
  ): SingleRowData<AssetOccupancyRowDTO>[] {
    return rows.map(row => this.convert(row, options));
  }

  private static statusLabel(
    row: AssetOccupancyRowDTO,
    options: AssetAvailabilitySingleRowConverterOptions
  ): string {
    if (row.status === 'assigned') {
      return this.translate(options, 'asset.requests.status.assigned', 'Assigned');
    }
    if (row.status === 'accepted') {
      return this.translate(options, 'asset.requests.status.borrowed', 'Borrowed');
    }
    return this.translate(options, 'asset.requests.status.pending', 'Pending');
  }

  private static surfaceTone(row: AssetOccupancyRowDTO): NonNullable<SingleRowData['surfaceTone']> {
    if (row.status === 'pending') {
      return 'warning';
    }
    if (row.status === 'assigned') {
      return 'info';
    }
    return 'success';
  }

  private static statusBadgeTone(row: AssetOccupancyRowDTO): NonNullable<SingleRowData['sideLabelTone']> {
    if (row.status === 'pending') {
      return 'warning';
    }
    if (row.status === 'assigned') {
      return 'info';
    }
    return 'success';
  }

  private static translate(
    options: AssetAvailabilitySingleRowConverterOptions,
    key: string,
    fallback: string
  ): string {
    return options.translate?.(key, fallback) ?? fallback;
  }
}

export const assetAvailabilitySingleRowConverter =
  AssetAvailabilitySingleRowConverter satisfies UiListConverter<
    AssetOccupancyRowDTO,
    SingleRowData<AssetOccupancyRowDTO>,
    AssetAvailabilitySingleRowConverterOptions | undefined
  >;
