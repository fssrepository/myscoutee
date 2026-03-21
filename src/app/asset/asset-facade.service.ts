import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../shared/app-demo-generators';
import { AppUtils } from '../shared/app-utils';
import type * as AppTypes from '../shared/core/base/models';
import { AssetsService, AssetTicketsService, AppContext, type UserDto } from '../shared/core';
import { DemoUsersRepository } from '../shared/core/demo';
import type { InfoCardData, InfoCardMenuAction } from '../shared/ui';
import type { ListQuery, PageResult } from '../shared/ui';

export interface AssetTicketListFilters {
  userId?: string;
  order?: AppTypes.AssetTicketOrder;
}

export interface OwnedAssetListFilters {
  userId?: string;
  type?: AppTypes.AssetType;
  refreshToken?: number;
}

type TicketPerson = Pick<UserDto, 'id' | 'name' | 'age' | 'city' | 'gender' | 'initials' | 'images'>;

@Injectable({
  providedIn: 'root'
})
export class AssetFacadeService {
  private readonly appCtx = inject(AppContext);
  private readonly assetsService = inject(AssetsService);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly demoUsersRepository = inject(DemoUsersRepository);

  private get users(): UserDto[] {
    return this.demoUsersRepository.queryAllUsers();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  activeUserId(): string {
    return this.appCtx.getActiveUserId().trim() || 'u1';
  }

  peekTicketCount(userId: string): number {
    return this.assetTicketsService.peekTicketCountByUser(userId);
  }

  async loadTicketPage(query: ListQuery<AssetTicketListFilters>): Promise<PageResult<AppTypes.ActivityListRow>> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    if (!userId) {
      return {
        items: [],
        total: 0
      };
    }
    const page = await this.assetTicketsService.queryTicketPage({
      userId,
      page: Math.max(0, Math.trunc(Number(query.page) || 0)),
      pageSize: Math.max(1, Math.trunc(Number(query.pageSize) || 1)),
      order: query.filters?.order === 'past' ? 'past' : 'upcoming'
    });
    return {
      items: page.items.map(row => this.cloneTicketRow(row)),
      total: page.total
    };
  }

  async loadOwnedAssetPage(query: ListQuery<OwnedAssetListFilters>): Promise<PageResult<AppTypes.AssetCard>> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    const type = query.filters?.type;
    if (!userId || (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies')) {
      return {
        items: [],
        total: 0
      };
    }
    const cards = await this.assetsService.queryOwnedAssetsByUser(userId);
    const filtered = cards.filter(card => card.type === type);
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map(card => this.cloneOwnedAsset(card)),
      total: filtered.length
    };
  }

  async loadSelectableOwnedAssetPage(
    query: ListQuery<OwnedAssetListFilters>,
    selectedAssetIds: readonly string[] = []
  ): Promise<PageResult<AppTypes.AssetCard>> {
    const userId = query.filters?.userId?.trim() || this.activeUserId();
    const type = query.filters?.type;
    if (!userId || (type !== 'Car' && type !== 'Accommodation' && type !== 'Supplies')) {
      return {
        items: [],
        total: 0
      };
    }
    const selectedIds = new Set(selectedAssetIds.map(assetId => assetId.trim()).filter(Boolean));
    const cards = await this.assetsService.queryOwnedAssetsByUser(userId);
    const filtered = cards
      .filter(card => card.type === type)
      .sort((left, right) => {
        const selectedDelta = Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
        if (selectedDelta !== 0) {
          return selectedDelta;
        }
        return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      });
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map(card => this.cloneOwnedAsset(card)),
      total: filtered.length
    };
  }

  ticketInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      rowId: `${row.type}:${row.id}`,
      groupLabel: options.groupLabel ?? null,
      title: row.title,
      imageUrl: this.ticketImageUrl(row),
      metaRows: [this.ticketMetaLine(row)],
      description: row.subtitle,
      leadingIcon: {
        icon: this.ticketLeadingIcon(row),
        tone: this.ticketLeadingIconTone(row)
      },
      mediaStart: {
        variant: 'avatar',
        tone: this.ticketSourceAvatarTone(row),
        label: this.ticketSourceAvatarLabel(row),
        interactive: false,
        ariaLabel: null
      },
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        icon: 'qr_code_2',
        interactive: true,
        ariaLabel: 'Open ticket QR code'
      },
      clickable: false
    };
  }

  ownedAssetInfoCard(
    card: AppTypes.AssetCard,
    options: { groupLabel?: string | null; selectMode?: boolean; selected?: boolean; selectDisabled?: boolean } = {}
  ): InfoCardData {
    const selectMode = options.selectMode === true;
    const selected = options.selected === true;
    return {
      rowId: `asset:${card.id}`,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: this.ownedAssetImageUrl(card),
      metaRows: [this.ownedAssetMetaLine(card)],
      description: card.details,
      leadingIcon: {
        icon: this.ownedAssetTypeIcon(card.type)
      },
      mediaStart: this.ownedAssetMediaStart(card),
      mediaEnd: selectMode
        ? {
            variant: 'toggle',
            tone: selected ? 'selected' : 'default',
            icon: 'add',
            selected,
            selectedIcon: 'check',
            interactive: true,
            disabled: options.selectDisabled === true,
            ariaLabel: selected ? 'Remove asset from basket' : 'Add asset to basket'
          }
        : {
            variant: 'avatar',
            tone: 'default',
            label: this.ownedAssetCapacityLabel(card),
            interactive: false,
            ariaLabel: null
          },
      menuActions: selectMode ? [] : this.ownedAssetMenuActions(card),
      clickable: false
    };
  }

  ownedAssetEmptyLabel(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'No accommodations yet';
    }
    if (type === 'Supplies') {
      return 'No supplies yet';
    }
    return 'No cars yet';
  }

  ownedAssetEmptyDescription(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'Add a stay, room, or place so it can show up here.';
    }
    if (type === 'Supplies') {
      return 'Add supplies or shared gear so the list can populate.';
    }
    return 'Add a car or ride so it can show up here.';
  }

  canOpenOwnedAssetMap(card: AppTypes.AssetCard): boolean {
    return card.type === 'Accommodation' && this.ownedAssetPrimaryLocation(card).length > 0;
  }

  ticketGroupLabel(dateIso: string): string {
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

  createTicketScanPayload(row: AppTypes.ActivityListRow): AppTypes.TicketScanPayload {
    const activeUser = this.resolveActiveTicketHolder();
    const issuedAtIso = AppUtils.toIsoDateTime(new Date());
    const userId = activeUser?.id?.trim() || this.activeUserId();
    const userName = activeUser?.name?.trim() || 'Ticket Holder';
    const holderAge = Math.max(0, Math.trunc(Number(activeUser?.age) || 0));
    const holderCity = activeUser?.city?.trim() || '';
    const code = `TKT-${row.id}-${AppDemoGenerators.hashText(`${userId}:${row.id}:${issuedAtIso}`)}`;
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
      eventDateLabel: this.ticketDateLabel(row),
      issuedAtIso
    };
  }

  ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    const user = this.ticketPayloadUser(payload);
    if (!user) {
      return '';
    }
    return AppDemoGenerators.firstImageUrl(user.images);
  }

  ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string {
    const user = this.ticketPayloadUser(payload);
    if (user?.initials?.trim()) {
      return user.initials.trim();
    }
    return AppUtils.initialsFromText(payload.holderName);
  }

  private cloneTicketRow(row: AppTypes.ActivityListRow): AppTypes.ActivityListRow {
    return { ...row };
  }

  private cloneOwnedAsset(card: AppTypes.AssetCard): AppTypes.AssetCard {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      requests: card.requests.map(request => ({ ...request }))
    };
  }

  private ticketImageUrl(row: AppTypes.ActivityListRow): string {
    const source = row.source as { imageUrl?: string } | null;
    return `${source?.imageUrl ?? ''}`.trim() || 'https://picsum.photos/seed/event-default/1200/700';
  }

  private ticketMetaLine(row: AppTypes.ActivityListRow): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${this.ticketDateLabel(row)} · ${this.ticketDistanceLabel(row.distanceKm)}`;
  }

  private ticketDateLabel(row: AppTypes.ActivityListRow): string {
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

  private ticketDistanceLabel(distanceKm: number): string {
    const rounded = Math.round((Number(distanceKm) || 0) * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  private ticketLeadingIcon(row: AppTypes.ActivityListRow): string {
    const visibility = this.ticketVisibility(row);
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private ticketLeadingIconTone(
    row: AppTypes.ActivityListRow
  ): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    const visibility = this.ticketVisibility(row);
    if (visibility === 'Friends only') {
      return 'friends';
    }
    if (visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private ticketVisibility(row: AppTypes.ActivityListRow): AppTypes.EventVisibility {
    const source = row.source as { visibility?: AppTypes.EventVisibility } | null;
    const visibility = source?.visibility;
    if (visibility === 'Friends only' || visibility === 'Invitation only') {
      return visibility;
    }
    return 'Public';
  }

  private ticketSourceAvatarTone(
    row: AppTypes.ActivityListRow
  ): NonNullable<InfoCardData['mediaStart']>['tone'] {
    const toneIndex = (AppDemoGenerators.hashText(`${row.type}:${row.id}:${row.title}`) % 8) + 1;
    return `tone-${toneIndex}` as NonNullable<InfoCardData['mediaStart']>['tone'];
  }

  private ticketSourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    const source = row.source as { avatar?: string; creatorInitials?: string } | null;
    const explicit = `${source?.avatar ?? source?.creatorInitials ?? ''}`.trim();
    if (explicit) {
      return explicit.slice(0, 2).toUpperCase();
    }
    return AppUtils.initialsFromText(row.title);
  }

  private ownedAssetImageUrl(card: AppTypes.AssetCard): string {
    return `${card.imageUrl ?? ''}`.trim() || AppDemoGenerators.defaultAssetImage(card.type, card.id || card.title || card.type.toLowerCase());
  }

  private ownedAssetMetaLine(card: AppTypes.AssetCard): string {
    const subtitle = card.subtitle.trim() || AppDemoGenerators.defaultAssetSubtitle(card.type);
    const city = card.city.trim();
    return [this.ownedAssetTypeLabel(card.type), subtitle, city].filter(Boolean).join(' · ');
  }

  private ownedAssetTypeLabel(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'Accommodation';
    }
    if (type === 'Supplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  private ownedAssetTypeIcon(type: AppTypes.AssetType): string {
    if (type === 'Accommodation') {
      return 'apartment';
    }
    if (type === 'Supplies') {
      return 'inventory_2';
    }
    return 'directions_car';
  }

  private ownedAssetCapacityLabel(card: AppTypes.AssetCard): string {
    return `${Math.max(1, Math.trunc(Number(card.capacityTotal) || 0))}`;
  }

  private ownedAssetPrimaryLocation(card: AppTypes.AssetCard): string {
    if (card.type !== 'Accommodation') {
      return '';
    }
    return (card.routes ?? [])
      .map(route => route.trim())
      .find(route => route.length > 0)
      ?? card.city.trim();
  }

  private ownedAssetMediaStart(card: AppTypes.AssetCard): NonNullable<InfoCardData['mediaStart']> | null {
    if (card.type !== 'Accommodation' || !this.canOpenOwnedAssetMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: 'Open accommodation map'
    };
  }

  private ownedAssetMenuActions(card: AppTypes.AssetCard): readonly InfoCardMenuAction[] {
    const label = this.ownedAssetTypeLabel(card.type).toLowerCase();
    return [
      {
        id: 'edit',
        label: `Edit ${label}`,
        icon: 'edit'
      },
      {
        id: 'delete',
        label: `Delete ${label}`,
        icon: 'delete',
        tone: 'destructive'
      }
    ];
  }

  private resolveActiveTicketHolder(): TicketPerson | null {
    const activeUserId = this.activeUserId();
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
