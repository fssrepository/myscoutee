import { Injectable, inject } from '@angular/core';

import { AppDemoGenerators } from '../shared/app-demo-generators';
import { AppUtils } from '../shared/app-utils';
import type * as AppTypes from '../shared/core/base/models';
import { AssetTicketsService, AppContext, type UserDto } from '../shared/core';
import type { InfoCardData } from '../shared/ui';
import type { ListQuery, PageResult } from '../shared/ui';

export interface AssetTicketListFilters {
  userId?: string;
  order?: AppTypes.AssetTicketOrder;
}

type TicketPerson = Pick<UserDto, 'id' | 'name' | 'age' | 'city' | 'gender' | 'initials' | 'images'>;

@Injectable({
  providedIn: 'root'
})
export class AssetFacadeService {
  private readonly appCtx = inject(AppContext);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  private readonly userById = new Map(this.users.map(user => [user.id, user]));

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

  ticketInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    const sourceLink = this.ticketSourceLink(row);
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
        interactive: sourceLink.length > 0,
        ariaLabel: sourceLink.length > 0 ? 'Open source link' : null
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

  ticketSourceLink(row: AppTypes.ActivityListRow): string {
    const source = row.source as { sourceLink?: string } | null;
    return `${source?.sourceLink ?? ''}`.trim();
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
    const first = (user.images ?? []).find((image): image is string => typeof image === 'string' && image.trim().length > 0);
    return first ?? this.profilePortraitUrlForUser(user, 0, 'ticket-scan');
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

  private profilePortraitUrlForUser(
    user: Pick<TicketPerson, 'gender' | 'id'>,
    index: number,
    context: string
  ): string {
    const genderFolder = user.gender === 'woman' ? 'women' : 'men';
    const seed = AppDemoGenerators.hashText(`portrait:${context}:${user.id}:${index}`);
    return `https://randomuser.me/api/portraits/${genderFolder}/${seed % 100}.jpg`;
  }
}
