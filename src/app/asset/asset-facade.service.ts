import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../shared/app-utils';
import { AppContext, AssetInfoCardConverter, AssetTicketInfoCardConverter } from '../shared/ui';
import {
  AssetCardBuilder,
  AssetDefaultsBuilder,
  UsersService,
  type UserDto
} from '../shared/core';
import type { InfoCardData } from '../shared/ui';

import type * as AssetContracts from '../shared/core/contracts/asset.interface';
import type * as AppDTOs from '../shared/core/contracts';
import type * as AppConstants from '../shared/core/common/constants';
type TicketPerson = Pick<UserDto, 'id' | 'name' | 'age' | 'city' | 'gender' | 'initials' | 'images'>;

@Injectable({
  providedIn: 'root'
})
export class AssetFacadeService {
  private readonly appCtx = inject(AppContext);
  private readonly usersService = inject(UsersService);

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  ticketInfoCard(
    row: AssetContracts.AssetTicketDTO,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return AssetTicketInfoCardConverter.convert(row, options);
  }

  ownedAssetInfoCard(
    card: AppDTOs.AssetCardDTO,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ): InfoCardData {
    return AssetInfoCardConverter.convert(card, options);
  }

  ownedAssetEmptyLabel(type: AppConstants.AssetType): string {
    return AssetDefaultsBuilder.ownedAssetEmptyLabel(type);
  }

  ownedAssetEmptyDescription(type: AppConstants.AssetType): string {
    return AssetDefaultsBuilder.ownedAssetEmptyDescription(type);
  }

  canOpenOwnedAssetMap(card: AppDTOs.AssetCardDTO): boolean {
    return AssetCardBuilder.canOpenMap(card);
  }

  ticketGroupLabel(dateIso: string): string {
    return this.ticketDateGroupLabel(dateIso);
  }

  createTicketScanPayload(row: AssetContracts.AssetTicketDTO): AssetContracts.TicketScanPayloadDTO {
    const activeUser = this.resolveActiveTicketHolder();
    return this.buildTicketScanPayload(row, activeUser ?? {
      id: this.currentActiveUserId(),
      name: 'Ticket Holder',
      age: 0,
      city: ''
    });
  }

  ticketPayloadAvatarUrl(payload: AssetContracts.TicketScanPayloadDTO | null): string {
    return this.ticketPersonAvatarUrl(this.ticketPayloadUser(payload));
  }

  ticketPayloadInitials(payload: AssetContracts.TicketScanPayloadDTO): string {
    return this.ticketPersonInitials(payload, this.ticketPayloadUser(payload));
  }

  private currentActiveUserId(): string {
    return this.appCtx.userProfileStore.getActiveUserId().trim();
  }

  private resolveActiveTicketHolder(): TicketPerson | null {
    const activeUserId = this.currentActiveUserId();
    const activeProfile = this.appCtx.userProfileStore.activeUserProfile();
    if (activeProfile && activeProfile.id.trim() === activeUserId) {
      return activeProfile;
    }
    return this.ticketPayloadUser({
      code: '',
      holderUserId: activeUserId,
      holderName: '',
      holderAge: 0,
      holderCity: '',
      holderRole: 'Member',
      eventId: '',
      eventTitle: '',
      eventSubtitle: '',
      eventTimeframe: '',
      eventDateLabel: '',
      issuedAtIso: ''
    });
  }

  private buildTicketScanPayload(
    row: AssetContracts.AssetTicketDTO,
    holder: Pick<UserDto, 'id' | 'name' | 'age' | 'city'>
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
      eventDateLabel: this.ticketDateLabel(row),
      issuedAtIso
    };
  }

  private ticketDateLabel(row: AssetContracts.AssetTicketDTO): string {
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

  private ticketDateGroupLabel(dateIso: string): string {
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

  private ticketPersonAvatarUrl(user: Pick<UserDto, 'images'> | null): string {
    return user ? AppUtils.firstImageUrl(user.images) : '';
  }

  private ticketPersonInitials(
    payload: AssetContracts.TicketScanPayloadDTO,
    user: Pick<UserDto, 'initials'> | null
  ): string {
    if (user?.initials?.trim()) {
      return user.initials.trim();
    }
    return AppUtils.initialsFromText(payload.holderName);
  }

  private ticketPayloadUser(payload: AssetContracts.TicketScanPayloadDTO | null): TicketPerson | null {
    const normalizedUserId = payload?.holderUserId?.trim() ?? '';
    if (!normalizedUserId) {
      return null;
    }
    const cachedProfile = this.appCtx.userProfileStore.getUserProfile(normalizedUserId);
    if (cachedProfile) {
      return cachedProfile;
    }
    return this.userById.get(normalizedUserId) ?? null;
  }
}
