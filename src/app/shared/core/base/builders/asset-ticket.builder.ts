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
    const encodedEventId = encodeURIComponent(normalizedEventId);
    const encodedHolderUserId = encodeURIComponent(normalizedHolderUserId);
    const body = `${encodedEventId}|${encodedHolderUserId}`;
    return `DEMO|${body}|${AppUtils.hashText(`ticket:${body}`).toString(36)}`;
  }

  static parseDemoScanCode(code: string): { eventId: string; holderUserId: string } | null {
    const parts = code.trim().split('|');
    if (parts.length !== 4 || parts[0] !== 'DEMO') {
      return null;
    }
    const body = `${parts[1]}|${parts[2]}`;
    if (parts[3] !== AppUtils.hashText(`ticket:${body}`).toString(36)) {
      return null;
    }
    try {
      const eventId = decodeURIComponent(parts[1]).trim();
      const holderUserId = decodeURIComponent(parts[2]).trim();
      return eventId && holderUserId ? { eventId, holderUserId } : null;
    } catch {
      return null;
    }
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
