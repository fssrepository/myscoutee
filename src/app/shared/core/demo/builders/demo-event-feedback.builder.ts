import { AppUtils } from '../../../app-utils';
import type { EventMenuItem } from '../../base/interfaces/activity-feed.interface';
import type { DemoUser } from '../../base/interfaces/user.interface';
import type {
  EventFeedbackCard,
  EventFeedbackOption,
  EventFeedbackPersistedState,
  EventFeedbackTraitOption,
  SubmittedEventFeedbackAnswer
} from '../../base/models';

export class DemoEventFeedbackBuilder {
  static buildEventFeedbackCards(options: {
    eventItems: EventMenuItem[];
    users: DemoUser[];
    activeUser: DemoUser;
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

  static buildSeededSubmittedState(options: {
    eventItem: EventMenuItem;
    users: DemoUser[];
    activeUser: DemoUser;
    eventDatesById: Record<string, string>;
    activityImageById: Record<string, string>;
    eventFeedbackUnlockDelayMs: number;
    eventOverallOptions: EventFeedbackOption[];
    hostImproveOptions: EventFeedbackOption[];
    attendeeCollabOptions: EventFeedbackOption[];
    attendeeRejoinOptions: EventFeedbackOption[];
    personalityTraitOptions: EventFeedbackTraitOption[];
    seedKey?: string;
  }): EventFeedbackPersistedState | null {
    const eventId = options.eventItem.id?.trim() ?? '';
    if (!eventId) {
      return null;
    }

    const eventCards = this.buildEventFeedbackCards({
      eventItems: [options.eventItem],
      users: options.users,
      activeUser: options.activeUser,
      eventDatesById: options.eventDatesById,
      activityImageById: options.activityImageById,
      eventFeedbackUnlockDelayMs: options.eventFeedbackUnlockDelayMs,
      eventOverallOptions: options.eventOverallOptions,
      hostImproveOptions: options.hostImproveOptions,
      attendeeCollabOptions: options.attendeeCollabOptions,
      attendeeRejoinOptions: options.attendeeRejoinOptions,
      personalityTraitOptions: options.personalityTraitOptions
    }).filter(card => !(card.kind === 'attendee' && card.attendeeUserId === options.activeUser.id));

    if (eventCards.length === 0) {
      return null;
    }

    const seed = AppUtils.hashText(options.seedKey?.trim() || `feedback-submitted:${options.activeUser.id}:${eventId}`);
    const submittedAtIso = this.seededSubmittedAtIso(
      eventId,
      options.eventDatesById,
      options.eventFeedbackUnlockDelayMs,
      seed
    );
    const answersByCardId: EventFeedbackPersistedState['answersByCardId'] = {};
    for (const card of eventCards) {
      const answer = this.seededSubmittedAnswer(card, seed, submittedAtIso);
      answersByCardId[answer.cardId] = answer;
    }

    return {
      id: this.eventFeedbackStateRecordId(options.activeUser.id, eventId),
      userId: options.activeUser.id,
      eventId,
      removed: false,
      submittedAtIso,
      organizerNote: this.seededOrganizerNote(eventCards[0], seed),
      answersByCardId
    };
  }


  static buildSeededPersistedStates(options: {
    eventItems: EventMenuItem[];
    users: DemoUser[];
    activeUser: DemoUser;
    eventDatesById: Record<string, string>;
    activityImageById: Record<string, string>;
    eventFeedbackUnlockDelayMs: number;
    eventOverallOptions: EventFeedbackOption[];
    hostImproveOptions: EventFeedbackOption[];
    attendeeCollabOptions: EventFeedbackOption[];
    attendeeRejoinOptions: EventFeedbackOption[];
    personalityTraitOptions: EventFeedbackTraitOption[];
  }): EventFeedbackPersistedState[] {
    const cardsByEventId = new Map<string, EventFeedbackCard[]>();

    for (const card of this.buildEventFeedbackCards(options)) {
      if (card.kind === 'attendee' && card.attendeeUserId === options.activeUser.id) {
        continue;
      }
      const eventCards = cardsByEventId.get(card.eventId) ?? [];
      eventCards.push(card);
      cardsByEventId.set(card.eventId, eventCards);
    }

    const states: EventFeedbackPersistedState[] = [];
    for (const [eventId, eventCards] of cardsByEventId.entries()) {
      if (eventCards.length === 0) {
        continue;
      }
      const seed = AppUtils.hashText(`feedback-state:${options.activeUser.id}:${eventId}`);
      const variant = seed % 8;
      if (variant >= 5) {
        continue;
      }

      const recordId = this.eventFeedbackStateRecordId(options.activeUser.id, eventId);
      if (variant === 4) {
        states.push({
          id: recordId,
          userId: options.activeUser.id,
          eventId,
          removed: true,
          submittedAtIso: null,
          organizerNote: '',
          answersByCardId: {}
        });
        continue;
      }

      if (variant === 3) {
        states.push({
          id: recordId,
          userId: options.activeUser.id,
          eventId,
          removed: false,
          submittedAtIso: null,
          organizerNote: this.seededOrganizerNote(eventCards[0], seed),
          answersByCardId: {}
        });
        continue;
      }

      const submittedAtIso = this.seededSubmittedAtIso(
        eventId,
        options.eventDatesById,
        options.eventFeedbackUnlockDelayMs,
        seed
      );
      const answersByCardId: EventFeedbackPersistedState['answersByCardId'] = {};
      for (const card of eventCards) {
        const answer = this.seededSubmittedAnswer(card, seed, submittedAtIso);
        answersByCardId[answer.cardId] = answer;
      }
      states.push({
        id: recordId,
        userId: options.activeUser.id,
        eventId,
        removed: false,
        submittedAtIso,
        organizerNote: (seed % 3) === 0 ? this.seededOrganizerNote(eventCards[0], seed) : '',
        answersByCardId
      });
    }

    return states;
  }

  private static seededSubmittedAnswer(
    card: EventFeedbackCard,
    seed: number,
    submittedAtIso: string
  ): SubmittedEventFeedbackAnswer {
    const primaryOption = this.seededOption(card.primaryOptions, `primary:${seed}:${card.id}`);
    const secondaryOption = this.seededOption(card.secondaryOptions, `secondary:${seed}:${card.id}`);
    const tags = new Set<string>();
    if (primaryOption?.impressionTag) {
      tags.add(primaryOption.impressionTag);
    }
    if (secondaryOption?.impressionTag) {
      tags.add(secondaryOption.impressionTag);
    }
    return {
      cardId: card.id,
      eventId: card.eventId,
      kind: card.kind,
      targetUserId: card.targetUserId ?? null,
      targetRole: card.targetRole ?? 'Member',
      primaryValue: primaryOption?.value ?? '',
      secondaryValue: secondaryOption?.value ?? '',
      personalityTraitIds: this.seededTraitIds(card, seed),
      tags: [...tags],
      submittedAtIso
    };
  }

  private static seededOption(
    options: EventFeedbackOption[],
    seedKey: string
  ): EventFeedbackOption | null {
    if (options.length === 0) {
      return null;
    }
    const index = AppUtils.hashText(seedKey) % options.length;
    return options[index] ?? options[0] ?? null;
  }

  private static seededSubmittedAtIso(
    eventId: string,
    eventDatesById: Record<string, string>,
    eventFeedbackUnlockDelayMs: number,
    seed: number
  ): string {
    const startMs = this.eventStartAtMs(eventId, eventDatesById);
    const baseMs = startMs === null
      ? Date.UTC(2026, 2, 20, 18, 0, 0, 0)
      : startMs + eventFeedbackUnlockDelayMs;
    const offsetMinutes = 45 + (seed % 180);
    return new Date(baseMs + (offsetMinutes * 60 * 1000)).toISOString();
  }

  private static seededOrganizerNote(card: EventFeedbackCard, seed: number): string {
    const noteTemplates = [
      `Strong overall flow for ${card.heading}. I would tighten the timing at the start next round.`,
      `The vibe was good around ${card.heading}. A clearer check-in and role handoff would help next time.`,
      `Good energy on ${card.heading}. I would make the pacing a bit smoother between sections.`
    ] as const;
    return noteTemplates[seed % noteTemplates.length] ?? noteTemplates[0];
  }

  private static eventFeedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

  private static seededTraitIds(card: EventFeedbackCard, seed: number): string[] {
    if (!Array.isArray(card.traitOptions) || card.traitOptions.length === 0) {
      return [];
    }
    const total = Math.min(3, card.traitOptions.length);
    const next = new Set<string>();
    for (let index = 0; index < total; index += 1) {
      const optionIndex = AppUtils.hashText(`trait:${seed}:${card.id}:${index}`) % card.traitOptions.length;
      const option = card.traitOptions[optionIndex];
      if (option?.id?.trim()) {
        next.add(option.id.trim());
      }
    }
    return [...next];
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

  private static feedbackHostUserForEvent(item: EventMenuItem, users: DemoUser[], activeUser: DemoUser): DemoUser {
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
    item: EventMenuItem,
    hostId: string,
    users: DemoUser[],
    activeUserId: string
  ): DemoUser[] {
    const attendeeIds = [...new Set([
      ...(item.acceptedMemberUserIds ?? []),
      ...(item.pendingMemberUserIds ?? [])
    ].map(userId => `${userId}`.trim()).filter(Boolean))]
      .filter(userId => userId !== activeUserId && userId !== hostId);
    if (attendeeIds.length > 0) {
      const usersById = new Map(users.map(user => [user.id, user]));
      const resolved = attendeeIds
        .map(userId => usersById.get(userId))
        .filter((user): user is DemoUser => Boolean(user));
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
    const picked: DemoUser[] = [];
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
