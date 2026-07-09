import type { ActivityMemberOwnerType } from '../../core/common/constants';
import type { ActivityMemberDTO } from '../../core/contracts/activity.interface';
import type { AppMenuPalette } from '../components/core/menu';
import type { ImageCardData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityMemberImageCardConverterOptions {
  ownerType?: ActivityMemberOwnerType | null;
  menuOpen?: boolean;
}

export class ActivityMemberImageCardConverter {
  static convert(
    dto: ActivityMemberDTO,
    options: ActivityMemberImageCardConverterOptions = {}
  ): ImageCardData {
    const age = Math.max(0, Math.trunc(Number(dto.profile?.age) || 0));
    const statusLabel = this.statusLabel(dto, options);
    const pendingDetail = dto.status === 'pending' || dto.status === 'disqualified'
      ? statusLabel
      : null;
    const statusChipLabel = dto.status === 'deleted' ? this.roleLabel(dto) : statusLabel;

    return {
      id: dto.id,
      title: age > 0 ? `${dto.name}, ${age}` : dto.name,
      subtitle: `${this.roleLabel(dto)} · ${dto.city}`,
      detail: pendingDetail,
      imageUrl: dto.avatarUrl,
      placeholderIcon: 'highlight_off',
      placeholderLabel: dto.initials,
      layout: 'overlay',
      toneClass: [
        'subevent-member-image-card',
        'activity-member-image-card',
        this.toneClass(dto),
        dto.status === 'deleted' ? 'ui-image-card--deleted' : '',
        options.menuOpen === true ? 'menu-open' : ''
      ].filter(Boolean).join(' '),
      statusChip: {
        icon: this.statusIcon(dto),
        title: statusChipLabel,
        ariaLabel: statusChipLabel,
        palette: this.statusPalette(dto),
        className: this.statusClass(dto)
      },
      badge: dto.status === 'deleted'
        ? {
          label: statusLabel,
          ariaLabel: statusLabel,
          className: 'ui-image-card__badge--danger'
        }
        : null
    };
  }

  static convertList(
    dtos: readonly ActivityMemberDTO[],
    options: ActivityMemberImageCardConverterOptions = {}
  ): ImageCardData[] {
    return dtos.map(dto => this.convert(dto, options));
  }

  private static toneClass(dto: ActivityMemberDTO): string {
    if (dto.status === 'disqualified') {
      return 'member-card-tone-disqualified';
    }
    if (dto.status === 'deleted') {
      return 'member-card-tone-deleted';
    }
    if (dto.status === 'accepted') {
      if (dto.role === 'Admin') {
        return 'member-card-tone-admin';
      }
      if (dto.role === 'Manager') {
        return 'member-card-tone-manager';
      }
      return 'member-card-tone-accepted';
    }
    return 'member-card-tone-invite-pending';
  }

  private static statusClass(dto: ActivityMemberDTO): string {
    if (dto.status === 'disqualified') {
      return 'member-status-disqualified';
    }
    if (dto.status === 'accepted' || dto.status === 'deleted') {
      if (dto.role === 'Admin') {
        return 'member-status-admin';
      }
      if (dto.role === 'Manager') {
        return 'member-status-manager';
      }
      return 'member-status-member';
    }
    return 'member-status-invite-pending';
  }

  private static statusIcon(dto: ActivityMemberDTO): string {
    if (dto.status === 'disqualified') {
      return 'gavel';
    }
    if (dto.status === 'accepted' || dto.status === 'deleted') {
      if (dto.role === 'Admin') {
        return 'admin_panel_settings';
      }
      if (dto.role === 'Manager') {
        return 'badge';
      }
      return 'person';
    }
    if (this.isJoinRequest(dto)) {
      return 'pending_actions';
    }
    return 'outgoing_mail';
  }

  private static statusLabel(
    dto: ActivityMemberDTO,
    options: Pick<ActivityMemberImageCardConverterOptions, 'ownerType'> = {}
  ): string {
    if (dto.status === 'disqualified') {
      return 'Disqualified';
    }
    if (dto.status === 'deleted') {
      return 'Deleted';
    }
    if (dto.status === 'accepted') {
      return this.roleLabel(dto);
    }
    if (this.isJoinRequest(dto)) {
      if (dto.requestKind === 'waitlist') {
        return 'Várólistán';
      }
      return dto.pendingSource === 'admin'
        ? 'Waiting For Admin Approval'
        : 'Waiting For Join Approval';
    }
    if (dto.pendingSource === 'admin') {
      return options.ownerType === 'asset' ? 'Waiting For Admin Approval' : 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  private static statusPalette(dto: ActivityMemberDTO): AppMenuPalette {
    if (dto.status === 'disqualified') {
      return 'muted';
    }
    if (dto.status === 'accepted' || dto.status === 'deleted') {
      if (dto.role === 'Admin') {
        return 'blue';
      }
      if (dto.role === 'Manager') {
        return 'gold';
      }
      return 'green';
    }
    return 'orange';
  }

  private static roleLabel(dto: ActivityMemberDTO): string {
    if (dto.role === 'Admin') {
      return 'Admin';
    }
    if (dto.role === 'Manager') {
      return 'Manager';
    }
    return 'Member';
  }

  private static isJoinRequest(dto: ActivityMemberDTO): boolean {
    return dto.requestKind === 'join'
      || dto.requestKind === 'approval'
      || dto.requestKind === 'waitlist'
      || (dto.requestKind == null && dto.pendingSource === 'member');
  }
}

export const activityMemberImageCardConverter =
  ActivityMemberImageCardConverter satisfies UiListConverter<
    ActivityMemberDTO,
    ImageCardData,
    ActivityMemberImageCardConverterOptions
  >;
