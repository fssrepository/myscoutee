import { Injectable, inject } from '@angular/core';

import { AppContext, AssetInfoCardConverter, AssetTicketInfoCardConverter } from '../shared/ui';
import {
  AssetCardBuilder,
  AssetDefaultsBuilder,
  AssetTicketMapper,
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
    return AssetTicketMapper.groupLabel(dateIso);
  }

  createTicketScanPayload(row: AssetContracts.AssetTicketDTO): AssetContracts.TicketScanPayloadDTO {
    const activeUser = this.resolveActiveTicketHolder();
    return AssetTicketMapper.toTicketScanPayload(row, activeUser ?? {
      id: this.currentActiveUserId(),
      name: 'Ticket Holder',
      age: 0,
      city: ''
    });
  }

  ticketPayloadAvatarUrl(payload: AssetContracts.TicketScanPayloadDTO | null): string {
    return AssetTicketMapper.payloadAvatarUrl(this.ticketPayloadUser(payload));
  }

  ticketPayloadInitials(payload: AssetContracts.TicketScanPayloadDTO): string {
    return AssetTicketMapper.payloadInitials(payload, this.ticketPayloadUser(payload));
  }

  private currentActiveUserId(): string {
    return this.appCtx.getActiveUserId().trim();
  }

  private resolveActiveTicketHolder(): TicketPerson | null {
    const activeUserId = this.currentActiveUserId();
    const activeProfile = this.appCtx.activeUserProfile();
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

  private ticketPayloadUser(payload: AssetContracts.TicketScanPayloadDTO | null): TicketPerson | null {
    const normalizedUserId = payload?.holderUserId?.trim() ?? '';
    if (!normalizedUserId) {
      return null;
    }
    const cachedProfile = this.appCtx.getUserProfile(normalizedUserId);
    if (cachedProfile) {
      return cachedProfile;
    }
    return this.userById.get(normalizedUserId) ?? null;
  }
}
