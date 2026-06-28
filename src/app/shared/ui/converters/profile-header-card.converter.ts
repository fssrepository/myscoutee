import type { IndicatorState } from '../components/indicator';
import type { HeaderCardModel } from '../components/smart-list/card/header-card';
import type { UserDto } from '../../core/contracts/user.interface';

export interface ProfileHeaderCardConverterOptions {
  admin?: boolean;
  name?: string | null;
  age?: number | string | null;
  city?: string | null;
  headline?: string | null;
  profileStatus?: UserDto['profileStatus'] | null;
  completionPercent?: number | null;
  showEdit?: boolean;
  editDisabled?: boolean;
  editAriaLabel?: string | null;
  showRing?: boolean;
  ringState?: IndicatorState | null;
  ringTitle?: string | null;
}

export class ProfileHeaderCardConverter {
  static convert(user: UserDto, options: ProfileHeaderCardConverterOptions = {}): HeaderCardModel {
    const admin = options.admin === true;
    const name = `${options.name ?? user.name ?? ''}`.trim();
    const completion = admin ? user.completion : options.completionPercent ?? user.completion;
    return {
      admin,
      statusClass: admin ? 'status-friends' : this.profileStatusClass(options.profileStatus ?? user.profileStatus),
      title: admin ? name : `${name}, ${options.age ?? user.age}`,
      meta: admin
        ? `${options.headline ?? user.headline ?? ''}`.trim() || 'Admin workspace'
        : `${options.city ?? user.city ?? ''}`.trim(),
      metaIcon: admin ? 'admin_panel_settings' : 'location_on',
      imageUrl: this.firstImageUrl(user.images),
      initials: user.initials,
      gender: user.gender,
      badgeLabel: admin ? 'ADMIN' : `${completion}%`,
      badgeStyle: this.completionBadgeStyle(completion),
      showEdit: options.showEdit === true,
      editDisabled: options.editDisabled === true,
      editAriaLabel: options.editAriaLabel ?? 'Edit',
      showRing: options.showRing === true,
      ringState: options.ringState ?? 'loading',
      ringTitle: options.ringTitle ?? null
    };
  }

  private static profileStatusClass(status: UserDto['profileStatus']): string {
    switch (status) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      case 'blocked':
        return 'status-blocked';
      default:
        return 'status-inactive';
    }
  }

  private static firstImageUrl(images: readonly string[] | null | undefined): string | null {
    return (images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .find(Boolean) ?? null;
  }

  private static completionBadgeStyle(value: number): Record<string, string> {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const hue = Math.round((clamped / 100) * 120);
    return {
      background: `hsl(${hue}, 82%, 84%)`,
      borderColor: `hsl(${hue}, 70%, 58%)`,
      color: `hsl(${hue}, 74%, 24%)`
    };
  }
}
