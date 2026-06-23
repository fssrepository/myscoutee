import { AppUtils } from '../../../app-utils';
import type * as AssetContracts from '../../contracts/asset.interface';
import type { UserDto } from '../../contracts/user.interface';

type TicketHolder = Pick<UserDto, 'id' | 'name' | 'age' | 'city'>;
type TicketPayloadPerson = Pick<UserDto, 'initials' | 'images'>;

export class AssetTicketMapper {
  static toTicketScanPayload(
    row: AssetContracts.AssetTicketDTO,
    holder: TicketHolder | null = null
  ): AssetContracts.TicketScanPayloadDTO {
    const issuedAtIso = `${row.startAt ?? row.dateIso}`.trim() || row.dateIso;
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

  static buildTicketDateLabel(row: AssetContracts.AssetTicketDTO): string {
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

  static payloadAvatarUrl(user: TicketPayloadPerson | null): string {
    if (!user) {
      return '';
    }
    return AppUtils.firstImageUrl(user.images);
  }

  static payloadInitials(
    payload: AssetContracts.TicketScanPayloadDTO,
    user: TicketPayloadPerson | null
  ): string {
    if (user?.initials?.trim()) {
      return user.initials.trim();
    }
    return AppUtils.initialsFromText(payload.holderName);
  }
}
