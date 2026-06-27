import { AppUtils } from '../../app-utils';
import type { UserDto } from '../../core';
import type * as AssetContracts from '../../core/contracts/asset.interface';

type TicketPerson = Pick<UserDto, 'initials' | 'images'> | null;

export interface AssetTicketScanViewModel {
  avatarUrl: string;
  initials: string;
  personLine: string;
  roleEventLine: string;
  dateLine: string;
}

export class AssetTicketScanConverter {
  static empty(): AssetTicketScanViewModel {
    return {
      avatarUrl: '',
      initials: '',
      personLine: '',
      roleEventLine: '',
      dateLine: ''
    };
  }

  static convert(
    payload: AssetContracts.TicketScanPayloadDTO | null,
    user: TicketPerson
  ): AssetTicketScanViewModel {
    if (!payload) {
      return this.empty();
    }
    return {
      avatarUrl: user ? AppUtils.firstImageUrl(user.images) : '',
      initials: user?.initials?.trim() || AppUtils.initialsFromText(payload.holderName),
      personLine: `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`,
      roleEventLine: `${payload.holderRole} · ${payload.eventTitle}`,
      dateLine: payload.eventTimeframe || payload.eventDateLabel
    };
  }

  static qrImageUrl(encodedPayload: string): string {
    if (!encodedPayload) {
      return '';
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&ecc=Q&margin=0&data=${encodeURIComponent(encodedPayload)}`;
  }
}
