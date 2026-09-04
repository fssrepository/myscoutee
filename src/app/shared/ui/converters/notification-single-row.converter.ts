import type {
  NotificationCategory,
  NotificationDto
} from '../../core/contracts/notification.interface';
import { AppUtils } from '../../app-utils';
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
  translate?: (key: string, fallback?: string | null) => string;
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
    const systemRandomRoom = this.isSystemGeneratedRoom(notification);
    const stageAvatar = this.hasStageAvatar(notification);
    const tournamentRoom = `${notification.payload?.['eventScope'] ?? ''}`.trim() === 'tournament-room';
    const sourceLabel = this.sourceLabel(notification.category);
    const timestamp = this.timestampLabel(notification.createdAtIso, options.locale);
    const occurrenceCount = Math.max(1, Math.trunc(Number(notification.occurrenceCount ?? 1)) || 1);
    const statusBadgeKey = `${notification.payload?.['notification_status_badge_key'] ?? ''}`.trim();
    const statusBadgeFallback = `${notification.payload?.['notification_status_badge_fallback'] ?? ''}`.trim();
    const statusBadgeLabel = statusBadgeKey && options.translate
      ? options.translate(statusBadgeKey, statusBadgeFallback)
      : statusBadgeFallback;
    return {
      id: notification.id,
      title: this.title(notification, options),
      subtitle: senderName ? `${senderName} · ${sourceLabel}` : sourceLabel,
      detail: this.message(notification, options),
      dateIso: notification.createdAtIso,
      avatarUrl: systemRandomRoom || stageAvatar ? null : `${notification.senderAvatarUrl ?? ''}`.trim() || null,
      avatarInitials: !systemRandomRoom && !stageAvatar && senderName ? this.initials(senderName) : null,
      avatarAriaLabel: senderName || sourceLabel,
      avatarToneClass: stageAvatar
        ? this.stageAvatarToneClass(notification)
        : systemRandomRoom ? 'notification-system-avatar' : null,
      accentHue: stageAvatar ? this.stageAccentHue(notification) : null,
      icon: stageAvatar
        ? `${notification.payload?.['notification_avatar_icon'] ?? ''}`.trim() || 'emoji_events'
        : systemRandomRoom
        ? tournamentRoom ? 'emoji_events' : 'auto_awesome'
        : senderName ? null : this.categoryIcon(notification.category),
      surfaceTone: this.surfaceTone(notification, read),
      toneClass: `notification-row notification-row--${notification.category}`,
      badges: [
        ...(statusBadgeLabel ? [{
          label: statusBadgeLabel,
          ariaLabel: statusBadgeLabel,
          title: statusBadgeLabel,
          tone: this.payloadTone(notification.payload?.['notification_status_badge_tone']) ?? 'muted',
          position: 'inline' as const
        }] : []),
        ...(occurrenceCount > 1 ? [{
          label: `${occurrenceCount}`,
          icon: 'repeat',
          ariaLabel: `${occurrenceCount} matching notifications`,
          title: `${occurrenceCount} matching notifications`,
          tone: 'warning' as const,
          position: 'inline' as const
        }] : []),
        {
          label: timestamp,
          icon: 'schedule',
          ariaLabel: timestamp,
          title: timestamp,
          tone: read ? 'muted' : this.badgeTone(notification),
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

  private message(
    notification: NotificationDto,
    options: NotificationSingleRowConverterOptions
  ): string {
    const key = `${notification.payload?.['notification_message_key'] ?? ''}`.trim();
    const translated = key && options.translate
      ? options.translate(key, notification.message)
      : notification.message;
    return this.compactMessage(
      notification,
      this.interpolatePayload(translated, notification.payload)
    );
  }

  private compactMessage(notification: NotificationDto, fallback: string): string {
    const payload = notification.payload;
    const assetTitle = `${payload?.['assetTitle'] ?? ''}`.trim();
    const quantity = `${payload?.['quantity'] ?? ''}`.trim();
    switch (notification.kind) {
      case 'event-invite': {
        const location = `${payload?.['location'] ?? ''}`.trim();
        return location ? `Invitation · ${location}` : 'Event invitation';
      }
      case 'asset-member-invite':
        return 'Asset invitation';
      case 'asset-admin-join-request': {
        const memberName = `${payload?.['memberName'] ?? ''}`.trim();
        return memberName ? `${memberName} requested access` : 'Access requested';
      }
      case 'event-supplies-open':
        return assetTitle ? `Contributions open · ${assetTitle}` : 'Contributions open';
      case 'event-supplies-contribution-added':
        return [quantity ? `${quantity} added` : 'Added', assetTitle].filter(Boolean).join(' · ');
      case 'event-supplies-contribution-removed':
        return [quantity ? `${quantity} removed` : 'Removed', assetTitle].filter(Boolean).join(' · ');
      default:
        return this.withoutRepeatedSender(fallback, notification.senderName);
    }
  }

  private withoutRepeatedSender(value: string, senderName?: string | null): string {
    const message = `${value ?? ''}`.trim();
    const sender = `${senderName ?? ''}`.trim();
    if (!sender || !message.toLocaleLowerCase().startsWith(`${sender.toLocaleLowerCase()} `)) {
      return message;
    }
    const remainder = message.slice(sender.length).trimStart();
    return remainder ? `${remainder.charAt(0).toLocaleUpperCase()}${remainder.slice(1)}` : message;
  }

  private title(
    notification: NotificationDto,
    options: NotificationSingleRowConverterOptions
  ): string {
    const key = `${notification.payload?.['notification_title_key'] ?? ''}`.trim();
    const translated = key && options.translate
      ? options.translate(key, notification.title)
      : notification.title;
    return this.interpolatePayload(translated, notification.payload);
  }

  private interpolatePayload(
    value: string,
    payload: NotificationDto['payload']
  ): string {
    return `${value ?? ''}`.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, key: string) => {
      const replacement = payload?.[key];
      return replacement == null ? match : `${replacement}`;
    });
  }

  private isSystemGeneratedRoom(notification: NotificationDto): boolean {
    return notification.kind === 'event-random-groups'
      || ['random-room', 'tournament-room'].includes(
        `${notification.payload?.['eventScope'] ?? ''}`.trim()
      );
  }

  private hasStageAvatar(notification: NotificationDto): boolean {
    return `${notification.payload?.['notification_avatar_tone'] ?? ''}`.trim() === 'stage';
  }

  private stageAvatarToneClass(notification: NotificationDto): string {
    switch (`${notification.kind ?? ''}`.trim()) {
      case 'event-stage-advanced':
      case 'event-tournament-won':
        return 'notification-stage-avatar notification-stage-avatar--positive';
      case 'event-stage-not-advanced':
      case 'event-tournament-not-won':
        return 'notification-stage-avatar notification-stage-avatar--negative';
      default:
        return 'notification-stage-avatar';
    }
  }

  private stageAccentHue(notification: NotificationDto): number {
    return AppUtils.tournamentStageAccentHue(
      Number(notification.payload?.['stageIndex']),
      Number(notification.payload?.['stageTotal'])
    );
  }

  private surfaceTone(notification: NotificationDto, read: boolean): SingleRowSurfaceTone {
    if (read) {
      return 'muted';
    }
    const contextualTone = this.contextualTone(notification);
    if (contextualTone) {
      return contextualTone;
    }
    switch (notification.category) {
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

  private badgeTone(notification: NotificationDto): SingleRowSurfaceTone {
    const contextualTone = this.contextualTone(notification);
    if (contextualTone) {
      return contextualTone;
    }
    switch (notification.category) {
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

  private contextualTone(notification: NotificationDto): SingleRowSurfaceTone | null {
    return this.payloadTone(notification.payload?.['notification_tone']);
  }

  private payloadTone(value: string | undefined): SingleRowSurfaceTone | null {
    const requestedTone = `${value ?? ''}`.trim();
    switch (requestedTone) {
      case 'info':
      case 'accent':
      case 'success':
      case 'warning':
      case 'danger':
        return requestedTone;
      default:
        return null;
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
