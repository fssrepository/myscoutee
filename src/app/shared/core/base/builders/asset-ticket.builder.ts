import { AppUtils } from '../../../app-utils';

import type * as AssetContracts from '../../contracts/asset.interface';

type TicketHolder = {
  id?: string | null;
  name?: string | null;
  initials?: string | null;
  images?: readonly string[] | null;
  age?: number | null;
  city?: string | null;
};

export class AssetTicketBuilder {
  static createScanPayload(
    row: AssetContracts.AssetTicketDTO,
    holder: TicketHolder
  ): AssetContracts.TicketScanPayloadDTO {
    const issuedAtIso = `${row.startAt ?? row.dateIso}`.trim() || row.dateIso;
    const userId = row.holderUserId.trim() || holder.id?.trim() || '';
    const userName = holder.name?.trim() || 'Ticket Holder';
    const holderAge = Math.max(0, Math.trunc(Number(holder.age) || 0));
    const holderCity = holder.city?.trim() || '';
    return {
      code: row.scanCode.trim(),
      holderUserId: userId,
      holderName: userName,
      holderInitials: holder.initials?.trim() || AppUtils.initialsFromText(userName),
      holderAvatarUrl: AppUtils.firstImageUrl(holder.images),
      holderAge,
      holderCity,
      holderRole: row.isAdmin ? 'Admin' : 'Member',
      eventId: row.id,
      eventTitle: row.title,
      eventSubtitle: row.subtitle,
      eventTimeframe: row.detail,
      eventDateLabel: this.dateLabel(row),
      issuedAtIso,
      usedAtIso: `${row.usedAtIso ?? ''}`.trim()
    };
  }

  static createDemoScanCode(eventId: string, holderUserId: string): string {
    const normalizedEventId = eventId.trim();
    const normalizedHolderUserId = holderUserId.trim();
    if (!normalizedEventId || !normalizedHolderUserId) {
      return '';
    }
    const source = `${normalizedEventId.length}:${normalizedEventId}\u001f${normalizedHolderUserId}`;
    const token = [0, 1, 2, 3]
      .map(round => this.demoScanHash(`ticket:${round}\u001f${source}`)
        .toString(16)
        .padStart(8, '0'))
      .join('');
    return `DEMO-${token}`;
  }

  static isDemoScanCode(code: string): boolean {
    return /^DEMO-[0-9a-f]{32}$/.test(code.trim());
  }

  private static demoScanHash(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  static dateLabel(row: AssetContracts.AssetTicketDTO): string {
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return row.detail;
    }
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  static groupLabel(dateIso: string): string {
    const parsed = new Date(dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}
