import type { ActivityMemberOwnerType } from '../../core/common/constants';
import type { ActivityMemberDTO } from '../../core/contracts/activity.interface';
import type { AppMenuPalette } from '../components/core/menu';
import type { ImageCardData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivityMemberImageCardConverterOptions {
  ownerType?: ActivityMemberOwnerType | null;
  menuOpen?: boolean;
  checkedInLabel?: string;
  formatCheckedInAt?: (value: string) => string;
}

export class ActivityMemberImageCardConverter {
  static convert(
    dto: ActivityMemberDTO,
    options: ActivityMemberImageCardConverterOptions = {}
  ): ImageCardData {
    const age = Math.max(0, Math.trunc(Number(dto.profile?.age) || 0));
    const statusLabel = this.statusLabel(dto);
    const checkedIn = this.isCheckedIn(dto);
    const checkedInLabel = options.checkedInLabel?.trim() || 'Checked in';
    const checkedInAt = `${dto.checkedInAtIso ?? ''}`.trim();
    const checkedInDetail = checkedIn
      ? [checkedInLabel, checkedInAt && options.formatCheckedInAt
          ? options.formatCheckedInAt(checkedInAt)
          : checkedInAt]
          .filter(Boolean)
          .join(' · ')
      : null;
    const pendingDetail = dto.status === 'pending' || dto.status === 'disqualified'
      ? statusLabel
      : null;
    const statusChipLabel = checkedIn
      ? checkedInDetail || checkedInLabel
      : (dto.status === 'deleted' ? this.roleLabel(dto) : statusLabel);

    return {
      id: dto.id,
      title: age > 0 ? `${dto.name}, ${age}` : dto.name,
      subtitle: `${this.roleLabel(dto)} · ${dto.city}`,
      detail: checkedInDetail || pendingDetail,
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
        label: checkedIn ? checkedInLabel : null,
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
    if (this.isCheckedIn(dto)) {
      return 'member-card-tone-checked-in';
    }
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
    if (this.isCheckedIn(dto)) {
      return 'member-status-checked-in';
    }
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
    if (this.isCheckedIn(dto)) {
      return 'how_to_reg';
    }
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

  private static statusLabel(dto: ActivityMemberDTO): string {
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
        return 'waiting.list';
      }
      return 'Waiting For Admin Approval';
    }
    if (dto.pendingSource === 'admin') {
      return 'Invitation Pending';
    }
    return 'Waiting For Admin Approval';
  }

  private static statusPalette(dto: ActivityMemberDTO): AppMenuPalette {
    if (this.isCheckedIn(dto)) {
      return 'green';
    }
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
    if (dto.status === 'pending'
        && dto.requestKind !== 'approval'
        && (
          dto.requestKind === 'invite'
          || dto.requestKind === 'waitlist-invite'
          || dto.pendingSource === 'admin'
          || dto.statusText.toLowerCase().includes('admin approval')
        )) {
      return false;
    }
    return dto.requestKind === 'join'
      || dto.requestKind === 'approval'
      || dto.requestKind === 'waitlist'
      || (dto.requestKind == null && dto.pendingSource === 'member');
  }

  private static isCheckedIn(dto: ActivityMemberDTO): boolean {
    return dto.status === 'accepted'
      && dto.attendanceStatus === 'checked-in'
      && `${dto.checkedInAtIso ?? ''}`.trim().length > 0;
  }
}

export const activityMemberImageCardConverter =
  ActivityMemberImageCardConverter satisfies UiListConverter<
    ActivityMemberDTO,
    ImageCardData,
    ActivityMemberImageCardConverterOptions
  >;
