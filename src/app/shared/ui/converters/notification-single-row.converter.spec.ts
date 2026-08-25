import { describe, expect, it } from 'vitest';

import type { NotificationDto } from '../../core/contracts/notification.interface';
import { NotificationSingleRowConverter } from './notification-single-row.converter';

describe('NotificationSingleRowConverter badges', () => {
  const converter = new NotificationSingleRowConverter();

  it('does not repeat unread state as a New badge on each row', () => {
    const row = converter.convert(notification());

    expect(row.badges?.map(badge => badge.label)).not.toContain('New');
    expect(row.badges).toHaveLength(1);
  });

  it('keeps the explicit Read status in the All view', () => {
    const row = converter.convert(notification({
      readAtIso: '2026-07-31T08:05:00.000Z'
    }));

    expect(row.badges?.map(badge => badge.label)).toContain('Read');
    expect(row.badges).toHaveLength(2);
  });

  it('renders random-room notifications with a non-user system avatar', () => {
    const row = converter.convert(notification({
      kind: 'event-random-groups',
      category: 'scheduled',
      senderName: 'MyScoutee System',
      senderAvatarUrl: '/unexpected-user-avatar.webp',
      payload: {
        eventScope: 'random-room'
      }
    }));

    expect(row.icon).toBe('auto_awesome');
    expect(row.avatarUrl).toBeNull();
    expect(row.avatarInitials).toBeNull();
    expect(row.avatarToneClass).toBe('notification-system-avatar');
    expect(row.subtitle).toContain('MyScoutee System');
  });

  it('uses the lifecycle context tone from the notification payload', () => {
    const row = converter.convert(notification({
      kind: 'event-definition-changed',
      category: 'event',
      payload: {
        notification_tone: 'warning'
      }
    }));

    expect(row.surfaceTone).toBe('warning');
    expect(row.badges?.[0]?.tone).toBe('warning');
  });

  it('uses the shared tournament-stage accent only for the avatar', () => {
    const row = converter.convert(notification({
      kind: 'event-stage-advanced',
      category: 'event',
      senderName: 'MyScoutee System',
      senderAvatarUrl: '/trophy.webp',
      payload: {
        notification_avatar_tone: 'stage',
        notification_avatar_icon: 'emoji_events',
        stageIndex: '2',
        stageTotal: '2',
        notification_tone: 'success'
      }
    }));

    expect(row.avatarUrl).toBeNull();
    expect(row.avatarInitials).toBeNull();
    expect(row.avatarToneClass).toBe('notification-stage-avatar notification-stage-avatar--positive');
    expect(row.icon).toBe('emoji_events');
    expect(row.accentHue).toBe(0);
    expect(row.surfaceTone).toBe('success');
  });

  it('crosses only a negative tournament result stage avatar', () => {
    const row = converter.convert(notification({
      kind: 'event-tournament-not-won',
      category: 'event',
      senderName: 'MyScoutee System',
      payload: {
        notification_avatar_tone: 'stage',
        notification_avatar_icon: 'emoji_events',
        stageIndex: '2',
        stageTotal: '2',
        notification_tone: 'warning'
      }
    }));

    expect(row.avatarToneClass).toBe('notification-stage-avatar notification-stage-avatar--negative');
    expect(row.icon).toBe('emoji_events');
    expect(row.accentHue).toBe(0);
  });

  it('resolves a write-side notification message key through the i18n bundle', () => {
    const row = converter.convert(notification({
      message: 'English transport fallback.',
      payload: {
        notification_message_key: 'notification.event.available.again.message'
      }
    }), {
      translate: key => key === 'notification.event.available.again.message'
        ? 'Az esemény újra elérhető.'
        : key
    });

    expect(row.detail).toBe('Az esemény újra elérhető.');
  });

  it('shows one repeat badge for an aggregated warning row', () => {
    const row = converter.convert(notification({
      occurrenceCount: 3,
      payload: { notification_tone: 'warning' }
    }));

    expect(row.badges?.map(badge => badge.label)).toContain('3');
    expect(row.badges?.find(badge => badge.label === '3')?.icon).toBe('repeat');
  });
});

function notification(
  patch: Partial<NotificationDto> = {}
): NotificationDto {
  return {
    id: 'notification-1',
    recipientUserId: 'user-1',
    kind: 'chat-message',
    category: 'chat',
    title: 'New message',
    message: 'A message arrived.',
    createdAtIso: '2026-07-31T08:00:00.000Z',
    readAtIso: null,
    revision: 1,
    ...patch
  };
}
