import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../../contracts/user.interface';
import type {
  EventFeedbackCard,
  EventFeedbackOption,
  EventFeedbackTraitOption
} from '../models';
import type { ActivityEventSeedItem } from '../models/event-seed-item.model';

export class EventFeedbackBuilder {
  static buildEventFeedbackCards(options: {
    eventItems: ActivityEventSeedItem[];
    users: UserDto[];
    activeUser: UserDto;
    eventDatesById: Record<string, string>;
    activityImageById: Record<string, string>;
    eventFeedbackUnlockDelayMs: number;
    eventOverallOptions: EventFeedbackOption[];
    hostImproveOptions: EventFeedbackOption[];
    attendeeCollabOptions: EventFeedbackOption[];
    attendeeRejoinOptions: EventFeedbackOption[];
    personalityTraitOptions: EventFeedbackTraitOption[];
  }): EventFeedbackCard[] {
    const nowMs = Date.now();
    const eventCards: EventFeedbackCard[] = [];
    for (const item of options.eventItems) {
      if (item.isAdmin) {
        continue;
      }
      const startMs = this.eventStartAtMs(item.id, options.eventDatesById);
      if (startMs === null || nowMs < startMs + options.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const eventLabel = this.eventFeedbackWhenLabel(item.id, options.eventDatesById);
      const host = this.feedbackHostUserForEvent(item, options.users, options.activeUser);
      const attendees = this.feedbackAttendeesForEvent(item, host.id, options.users, options.activeUser.id);
      eventCards.push({
        id: `feedback-event-${item.id}`,
        eventId: item.id,
        kind: 'event',
        targetUserId: host.id,
        targetRole: 'Admin',
        icon: 'event_available',
        imageUrl: options.activityImageById[item.id] ?? `https://picsum.photos/seed/event-feedback-card-${item.id}/1200/700`,
        toneClass: 'feedback-card-tone-event feedback-role-admin',
        heading: item.title,
        subheading: `${eventLabel} · ${item.shortDescription}`,
        identityTitle: `${host.name} · Host`,
        identitySubtitle: `Admin · ${host.city}`,
        identityStatusClass: 'member-status-admin',
        identityStatusIcon: 'admin_panel_settings',
        questionPrimary: `How did ${item.title} feel for you overall?`,
        questionSecondary: `What should ${host.name} improve next time?`,
        primaryOptions: options.eventOverallOptions,
        secondaryOptions: options.hostImproveOptions,
        traitQuestion: `Which traits describe ${host.name} best as the event creator?`,
        traitOptions: options.personalityTraitOptions,
        selectedTraitIds: [],
        answerPrimary: '',
        answerSecondary: ''
      });
      for (const attendee of attendees) {
        const attendeeRole = this.feedbackRoleForAttendee(item.id, attendee.id);
        eventCards.push({
          id: `feedback-attendee-${item.id}-${attendee.id}`,
          eventId: item.id,
          kind: 'attendee',
          attendeeUserId: attendee.id,
          targetUserId: attendee.id,
          targetRole: attendeeRole,
          icon: 'groups',
          imageUrl: AppUtils.firstImageUrl(attendee.images),
          toneClass: `feedback-card-tone-attendee ${this.feedbackRoleToneClass(attendeeRole)}`,
          heading: `${attendee.name} · ${item.title}`,
          subheading: `Attendee feedback · ${eventLabel}`,
          identityTitle: `${attendee.name}, ${attendee.age}`,
          identitySubtitle: `${attendeeRole} · ${attendee.city}`,
          identityStatusClass: this.feedbackRoleStatusClass(attendeeRole),
          identityStatusIcon: this.feedbackRoleStatusIcon(attendeeRole),
          questionPrimary: `How was collaboration with ${attendee.name} (${attendee.traitLabel}) during this event?`,
          questionSecondary: `Would you team up with ${attendee.name} again in a future event?`,
          primaryOptions: options.attendeeCollabOptions,
          secondaryOptions: options.attendeeRejoinOptions,
          traitQuestion: `Which personality traits best matched ${attendee.name} in this event?`,
          traitOptions: options.personalityTraitOptions,
          selectedTraitIds: [],
          answerPrimary: '',
          answerSecondary: ''
        });
      }
    }
    return eventCards;
  }

  private static eventStartAtMs(eventId: string, eventDatesById: Record<string, string>): number | null {
    const iso = eventDatesById[eventId];
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private static eventFeedbackWhenLabel(eventId: string, eventDatesById: Record<string, string>): string {
    const startMs = this.eventStartAtMs(eventId, eventDatesById);
    if (startMs === null) {
      return 'Recent event';
    }
    const parsed = new Date(startMs);
    const day = parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  }

  private static feedbackHostUserForEvent(item: ActivityEventSeedItem, users: UserDto[], activeUser: UserDto): UserDto {
    const creatorUserId = item.creatorUserId?.trim() ?? '';
    if (creatorUserId) {
      const creator = users.find(user => user.id === creatorUserId);
      if (creator) {
        return creator;
      }
    }
    const candidates = users.filter(user => user.id !== activeUser.id);
    if (candidates.length === 0) {
      return activeUser;
    }
    const index = AppUtils.hashText(`feedback-host:${item.id}`) % candidates.length;
    return candidates[index] ?? candidates[0];
  }

  private static feedbackAttendeesForEvent(
    item: ActivityEventSeedItem,
    hostId: string,
    users: UserDto[],
    activeUserId: string
  ): UserDto[] {
    const attendeeIds = [...new Set([
      ...(item.acceptedMemberUserIds ?? []),
      ...(item.pendingMemberUserIds ?? [])
    ].map(userId => `${userId}`.trim()).filter(Boolean))]
      .filter(userId => userId !== activeUserId && userId !== hostId);
    if (attendeeIds.length > 0) {
      const usersById = new Map(users.map(user => [user.id, user]));
      const resolved = attendeeIds
        .map(userId => usersById.get(userId))
        .filter((user): user is UserDto => Boolean(user));
      if (resolved.length > 0) {
        return resolved.slice(0, Math.min(5, resolved.length));
      }
    }

    const candidates = users.filter(user => user.id !== activeUserId && user.id !== hostId);
    if (candidates.length === 0) {
      return [];
    }
    const seed = AppUtils.hashText(`feedback-attendees:${item.id}`);
    const desired = Math.min(candidates.length, 3 + (seed % 4));
    const picked: UserDto[] = [];
    for (let index = 0; index < candidates.length && picked.length < desired; index += 1) {
      const candidate = candidates[(seed + (index * 3)) % candidates.length];
      if (!candidate || candidate.id === activeUserId || picked.some(item => item.id === candidate.id)) {
        continue;
      }
      picked.push(candidate);
    }
    return picked;
  }

  private static feedbackRoleForAttendee(eventId: string, attendeeUserId: string): 'Admin' | 'Manager' | 'Member' {
    const seed = AppUtils.hashText(`feedback-role:${eventId}:${attendeeUserId}`);
    if (seed % 11 === 0) {
      return 'Admin';
    }
    if (seed % 4 === 0) {
      return 'Manager';
    }
    return 'Member';
  }

  private static feedbackRoleToneClass(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'feedback-role-admin';
    }
    if (role === 'Manager') {
      return 'feedback-role-manager';
    }
    return 'feedback-role-member';
  }

  private static feedbackRoleStatusClass(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'member-status-admin';
    }
    if (role === 'Manager') {
      return 'member-status-manager';
    }
    return 'member-status-member';
  }

  private static feedbackRoleStatusIcon(role: 'Admin' | 'Manager' | 'Member'): string {
    if (role === 'Admin') {
      return 'admin_panel_settings';
    }
    if (role === 'Manager') {
      return 'manage_accounts';
    }
    return 'person';
  }
}
