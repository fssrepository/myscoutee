import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../interfaces/user.interface';
import type * as AppTypes from '../models';

type TicketPerson = Pick<UserDto, 'id' | 'name' | 'age' | 'city'>;

export class AssetTicketConverter {
  static toTicketScanPayload(
    row: AppTypes.ActivityListRow,
    holder: TicketPerson | null = null
  ): AppTypes.TicketScanPayload {
    const source = row.source as {
      createdDate?: string;
      createdAtIso?: string;
      updatedDate?: string;
    } | null;
    const issuedAtIso = `${source?.createdDate ?? source?.createdAtIso ?? source?.updatedDate ?? row.dateIso}`.trim()
      || row.dateIso;
    const userId = holder?.id?.trim() || '';
    const userName = holder?.name?.trim() || 'Ticket Holder';
    const holderAge = Math.max(0, Math.trunc(Number(holder?.age) || 0));
    const holderCity = holder?.city?.trim() || '';
    const stableKey = `${userId}:${row.id}:${row.type}`;
    const code = `TKT-${AppUtils.hashText(stableKey)}-${AppUtils.hashText(`${stableKey}:${issuedAtIso}`)}`;
    return {
      code,
      holderUserId: userId,
      holderName: userName,
      holderAge,
      holderCity,
      holderRole: row.isAdmin ? 'Admin' : 'Member',
      eventId: row.id,
      eventTitle: row.title,
      eventSubtitle: row.subtitle,
      eventTimeframe: row.detail,
      eventDateLabel: this.buildTicketDateLabel(row),
      issuedAtIso
    };
  }

  static buildTicketDateLabel(row: AppTypes.ActivityListRow): string {
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
}
