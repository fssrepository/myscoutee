import { Injectable, inject } from '@angular/core';

import { DemoAssetBuilder } from '../shared/core/demo/builders';
import type * as AppTypes from '../shared/core/base/models';
import {
  AppContext,
  AssetDefaultsBuilder,
  AssetCardBuilder,
  AssetInfoCardBuilder,
  AssetTicketConverter,
  UsersService,
  type UserDto
} from '../shared/core';
import type { InfoCardData } from '../shared/ui';

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
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return AssetInfoCardBuilder.buildTicketInfoCard(row, options);
  }

  ownedAssetInfoCard(
    card: AppTypes.AssetCard,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ): InfoCardData {
    return AssetInfoCardBuilder.buildOwnedAssetInfoCard(card, {
      ...options,
      fallbackImageUrl: DemoAssetBuilder.defaultAssetImage(card.type, card.id || card.title || card.type.toLowerCase()),
      fallbackSubtitle: DemoAssetBuilder.defaultAssetSubtitle(card.type)
    });
  }

  ownedAssetEmptyLabel(type: AppTypes.AssetType): string {
    return AssetDefaultsBuilder.ownedAssetEmptyLabel(type);
  }

  ownedAssetEmptyDescription(type: AppTypes.AssetType): string {
    return AssetDefaultsBuilder.ownedAssetEmptyDescription(type);
  }

  canOpenOwnedAssetMap(card: AppTypes.AssetCard): boolean {
    return AssetCardBuilder.canOpenMap(card);
  }

  ticketGroupLabel(dateIso: string): string {
    return AssetInfoCardBuilder.buildTicketGroupLabel(dateIso);
  }

  createTicketScanPayload(row: AppTypes.ActivityListRow): AppTypes.TicketScanPayload {
    const activeUser = this.resolveActiveTicketHolder();
    return AssetTicketConverter.toTicketScanPayload(row, activeUser ?? {
      id: this.currentActiveUserId(),
      name: 'Ticket Holder',
      age: 0,
      city: ''
    });
  }

  ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    return AssetInfoCardBuilder.resolveTicketPayloadAvatarUrl(this.ticketPayloadUser(payload));
  }

  ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string {
    return AssetInfoCardBuilder.resolveTicketPayloadInitials(payload, this.ticketPayloadUser(payload));
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

  private ticketPayloadUser(payload: AppTypes.TicketScanPayload | null): TicketPerson | null {
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
