import type {
  NotificationCategory,
  NotificationDto
} from '../../core/contracts/notification.interface';
import type {
  SingleRowData,
  SingleRowSurfaceTone
} from '../components/core/smart-list/card/card.types';
import type {
  ConverterOptionsArg,
  UiConverter
} from './converter.types';

export interface NotificationSingleRowConverterOptions {
  locale?: string | null;
  progressRing?: boolean;
}

export class NotificationSingleRowConverter implements UiConverter<
  NotificationDto,
  SingleRowData<NotificationDto>,
  NotificationSingleRowConverterOptions | undefined
> {
  convert(
    notification: NotificationDto,
    ...optionsArg: ConverterOptionsArg<NotificationSingleRowConverterOptions | undefined>
  ): SingleRowData<NotificationDto> {
    const options = optionsArg[0] ?? {};
    const read = Boolean(`${notification.readAtIso ?? ''}`.trim());
    const senderName = `${notification.senderName ?? ''}`.trim();
    const systemRandomRoom = this.isSystemRandomRoom(notification);
    const sourceLabel = this.sourceLabel(notification.category);
    const timestamp = this.timestampLabel(notification.createdAtIso, options.locale);
    return {
      id: notification.id,
      title: notification.title,
      subtitle: senderName ? `${senderName} · ${sourceLabel}` : sourceLabel,
      detail: notification.message,
      dateIso: notification.createdAtIso,
      avatarUrl: systemRandomRoom ? null : `${notification.senderAvatarUrl ?? ''}`.trim() || null,
      avatarInitials: !systemRandomRoom && senderName ? this.initials(senderName) : null,
      avatarAriaLabel: senderName || sourceLabel,
      avatarToneClass: systemRandomRoom ? 'notification-system-avatar' : null,
      icon: systemRandomRoom
        ? 'auto_awesome'
        : senderName ? null : this.categoryIcon(notification.category),
      surfaceTone: this.surfaceTone(notification.category, read),
      toneClass: `notification-row notification-row--${notification.category}`,
      badges: [
        {
          label: timestamp,
          icon: 'schedule',
          ariaLabel: timestamp,
          title: timestamp,
          tone: read ? 'muted' : this.badgeTone(notification.category),
          position: 'top-right'
        },
        ...(read ? [{
          label: 'Read',
          icon: 'done_all',
          tone: 'muted' as const,
          position: 'inline' as const
        }] : [])
      ],
      menuActions: read ? [] : ['markNotificationRead'],
      progressRing: options.progressRing === true,
      eagerDetail: {
        ...notification,
        payload: notification.payload ? { ...notification.payload } : null
      }
    };
  }

  private isSystemRandomRoom(notification: NotificationDto): boolean {
    return notification.kind === 'event-random-groups'
      || `${notification.payload?.['eventScope'] ?? ''}`.trim() === 'random-room';
  }

  private surfaceTone(category: NotificationCategory, read: boolean): SingleRowSurfaceTone {
    if (read) {
      return 'muted';
    }
    switch (category) {
      case 'chat':
      case 'event':
        return 'info';
      case 'event-admin':
        return 'accent';
      case 'asset':
        return 'warning';
      case 'app-admin':
        return 'danger';
      case 'scheduled':
        return 'success';
      default:
        return 'neutral';
    }
  }

  private badgeTone(category: NotificationCategory): SingleRowSurfaceTone {
    switch (category) {
      case 'chat':
      case 'event':
        return 'info';
      case 'event-admin':
        return 'accent';
      case 'asset':
        return 'warning';
      case 'app-admin':
        return 'danger';
      case 'scheduled':
        return 'success';
      default:
        return 'neutral';
    }
  }

  private categoryIcon(category: NotificationCategory): string {
    switch (category) {
      case 'user':
        return 'person';
      case 'chat':
        return 'chat';
      case 'event':
        return 'event';
      case 'event-admin':
        return 'admin_panel_settings';
      case 'asset':
        return 'inventory_2';
      case 'app-admin':
        return 'verified_user';
      case 'scheduled':
        return 'schedule';
    }
  }

  private sourceLabel(category: NotificationCategory): string {
    switch (category) {
      case 'user':
        return 'Member';
      case 'chat':
        return 'Chat';
      case 'event':
        return 'Event';
      case 'event-admin':
        return 'Event admin';
      case 'asset':
        return 'Asset';
      case 'app-admin':
        return 'MyScoutee';
      case 'scheduled':
        return 'Scheduled';
    }
  }

  private timestampLabel(value: string, locale?: string | null): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.trim();
    }
    try {
      return new Intl.DateTimeFormat(locale?.trim() || undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  private initials(value: string): string {
    const initials = value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || 'N';
  }
}

export const notificationSingleRowConverter = new NotificationSingleRowConverter();
