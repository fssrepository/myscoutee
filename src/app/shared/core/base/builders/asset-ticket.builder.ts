import { AppUtils } from '../../../app-utils';

import type * as AssetContracts from '../../contracts/asset.interface';

type TicketHolder = {
  id?: string | null;
  name?: string | null;
  age?: number | null;
  city?: string | null;
};

export class AssetTicketBuilder {
  static createScanPayload(
    row: AssetContracts.AssetTicketDTO,
    holder: TicketHolder
  ): AssetContracts.TicketScanPayloadDTO {
    const issuedAtIso = `${row.startAt ?? row.dateIso}`.trim() || row.dateIso;
    const userId = holder.id?.trim() || '';
    const userName = holder.name?.trim() || 'Ticket Holder';
    const holderAge = Math.max(0, Math.trunc(Number(holder.age) || 0));
    const holderCity = holder.city?.trim() || '';
    const stableKey = `${userId}:${row.id}:${row.type}`;
    return {
      code: `TKT-${AppUtils.hashText(stableKey)}-${AppUtils.hashText(`${stableKey}:${issuedAtIso}`)}`,
      holderUserId: userId,
      holderName: userName,
      holderAge,
      holderCity,
      holderRole: row.isAdmin ? 'Admin' : 'Member',
      eventId: row.id,
      eventTitle: row.title,
      eventSubtitle: row.subtitle,
      eventTimeframe: row.detail,
      eventDateLabel: this.dateLabel(row),
      issuedAtIso
    };
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
