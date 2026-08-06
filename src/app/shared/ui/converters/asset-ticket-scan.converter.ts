import * as QRCode from 'qrcode';

import { AppUtils } from '../../app-utils';
import type { UserDto } from '../../core';
import type * as AssetContracts from '../../core/contracts/asset.interface';

type TicketPerson = Pick<UserDto, 'initials' | 'images'> | null;

export interface AssetTicketScanViewModel {
  avatarUrl: string;
  initials: string;
  personLine: string;
  roleBadgeLabel: string;
  eventLine: string;
  dateLine: string;
}

export class AssetTicketScanConverter {
  static empty(): AssetTicketScanViewModel {
    return {
      avatarUrl: '',
      initials: '',
      personLine: '',
      roleBadgeLabel: '',
      eventLine: '',
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
      avatarUrl: payload.holderAvatarUrl?.trim()
        || (user ? AppUtils.firstImageUrl(user.images) : ''),
      initials: payload.holderInitials?.trim()
        || user?.initials?.trim()
        || AppUtils.initialsFromText(payload.holderName),
      personLine: `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`,
      roleBadgeLabel: this.contextualRoleBadge(payload.holderRole),
      eventLine: payload.eventTitle,
      dateLine: payload.eventTimeframe || payload.eventDateLabel
    };
  }

  private static contextualRoleBadge(role: string): string {
    return role.trim();
  }

  static async qrImageDataUrl(scanCode: string): Promise<string> {
    const normalizedCode = scanCode.trim();
    if (!normalizedCode) {
      return '';
    }
    return QRCode.toDataURL(normalizedCode, {
      errorCorrectionLevel: 'Q',
      margin: 0,
      width: 1024
    });
  }
}
