import type { EventFeedbackPersistedState } from '../../source/entity/event.entity';
import type { UserRecord } from '../../source/entity/user.entity';
import { environment } from '../../../../../../environments/environment';
import { AppUtils } from '../../../../app-utils';
import type { ActivityMemberRole } from '../../../common/constants';
import type { ActivityEventRecord, SubmittedEventFeedbackAnswer } from '../../../contracts/activity.interface';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../seed-constants';

interface SeedEventFeedbackOptionRecord {
  value: string;
  impressionTag?: string;
}

interface SeedEventFeedbackTraitOptionRecord {
  id: string;
}

interface SeedEventFeedbackCardRecord {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: ActivityMemberRole;
  heading: string;
  primaryOptions: readonly SeedEventFeedbackOptionRecord[];
  secondaryOptions: readonly SeedEventFeedbackOptionRecord[];
  traitOptions: readonly SeedEventFeedbackTraitOptionRecord[];
}

interface SeedEventFeedbackOptionInputs {
  eventFeedbackUnlockDelayMs: number;
  eventOverallOptions: readonly SeedEventFeedbackOptionRecord[];
  hostImproveOptions: readonly SeedEventFeedbackOptionRecord[];
  attendeeCollabOptions: readonly SeedEventFeedbackOptionRecord[];
  attendeeRejoinOptions: readonly SeedEventFeedbackOptionRecord[];
  personalityTraitOptions: readonly SeedEventFeedbackTraitOptionRecord[];
}

export class SeedEventFeedbackBuilder {
  static buildSeededSubmittedState(options: {
    eventRecord: ActivityEventRecord;
    users: readonly UserRecord[];
    activeUser: UserRecord;
    seedKey?: string;
  } & SeedEventFeedbackOptionInputs): EventFeedbackPersistedState | null {
    const eventId = options.eventRecord.id?.trim() ?? '';
    if (!eventId) {
      return null;
    }

    const eventCards = this.buildEventFeedbackCards({
      eventRecords: [options.eventRecord],
      users: options.users,
      activeUser: options.activeUser,
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
      options.eventRecord,
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
    eventRecords: readonly ActivityEventRecord[];
    users: readonly UserRecord[];
    activeUser: UserRecord;
  } & SeedEventFeedbackOptionInputs): EventFeedbackPersistedState[] {
    const eventRecordsById = new Map(
      options.eventRecords
        .map(record => [record.id?.trim() ?? '', record] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
    const cardsByEventId = new Map<string, SeedEventFeedbackCardRecord[]>();

    for (const card of this.buildEventFeedbackCards(options)) {
      if (card.kind === 'attendee' && card.attendeeUserId === options.activeUser.id) {
        continue;
      }
      const eventCards = cardsByEventId.get(card.eventId) ?? [];
      eventCards.push(card);
      cardsByEventId.set(card.eventId, eventCards);
    }

    const orderedEventIds = [...cardsByEventId.keys()].sort((left, right) => {
      const leftStartAtMs = this.eventStartAtMs(eventRecordsById.get(left)) ?? 0;
      const rightStartAtMs = this.eventStartAtMs(eventRecordsById.get(right)) ?? 0;
      return leftStartAtMs - rightStartAtMs || left.localeCompare(right);
    });
    const states: EventFeedbackPersistedState[] = [];
    for (const [index, eventId] of orderedEventIds.entries()) {
      const eventRecord = eventRecordsById.get(eventId);
      const eventCards = cardsByEventId.get(eventId) ?? [];
      if (!eventRecord || eventCards.length === 0) {
        continue;
      }
      const seed = AppUtils.hashText(`feedback-state:${options.activeUser.id}:${eventId}`);
      const recordId = this.eventFeedbackStateRecordId(options.activeUser.id, eventId);
      const variant = index % 3;
      if (variant === 0) {
        continue;
      }
      if (variant === 2) {
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

      const submittedAtIso = this.seededSubmittedAtIso(
        eventRecord,
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

  private static buildEventFeedbackCards(options: {
    eventRecords: readonly ActivityEventRecord[];
    users: readonly UserRecord[];
    activeUser: UserRecord;
  } & SeedEventFeedbackOptionInputs): SeedEventFeedbackCardRecord[] {
    const nowMs = Date.now();
    const eventCards: SeedEventFeedbackCardRecord[] = [];
    for (const record of options.eventRecords) {
      const eventId = record.id?.trim() ?? '';
      if (!eventId || this.isEventAdminRecord(record, options.activeUser.id)) {
        continue;
      }
      const startMs = this.eventStartAtMs(record);
      if (startMs === null || nowMs < startMs + options.eventFeedbackUnlockDelayMs) {
        continue;
      }
      const host = this.feedbackHostUserForEvent(record, options.users, options.activeUser);
      const attendees = this.feedbackAttendeesForEvent(record, host.id, options.users, options.activeUser.id);
      eventCards.push({
        id: `feedback-event-${eventId}`,
        eventId,
        kind: 'event',
        targetUserId: host.id,
        targetRole: 'Admin',
        heading: record.title,
        primaryOptions: options.eventOverallOptions,
        secondaryOptions: options.hostImproveOptions,
        traitOptions: options.personalityTraitOptions
      });
      for (const attendee of attendees) {
        const attendeeRole = this.feedbackRoleForAttendee(eventId, attendee.id);
        eventCards.push({
          id: `feedback-attendee-${eventId}-${attendee.id}`,
          eventId,
          kind: 'attendee',
          attendeeUserId: attendee.id,
          targetUserId: attendee.id,
          targetRole: attendeeRole,
          heading: `${attendee.name} · ${record.title}`,
          primaryOptions: options.attendeeCollabOptions,
          secondaryOptions: options.attendeeRejoinOptions,
          traitOptions: options.personalityTraitOptions
        });
      }
    }
    return eventCards;
  }

  private static seededSubmittedAnswer(
    card: SeedEventFeedbackCardRecord,
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
    options: readonly SeedEventFeedbackOptionRecord[],
    seedKey: string
  ): SeedEventFeedbackOptionRecord | null {
    if (options.length === 0) {
      return null;
    }
    const index = AppUtils.hashText(seedKey) % options.length;
    return options[index] ?? options[0] ?? null;
  }

  private static seededSubmittedAtIso(
    eventRecord: ActivityEventRecord,
    eventFeedbackUnlockDelayMs: number,
    seed: number
  ): string {
    const startMs = this.eventStartAtMs(eventRecord);
    const baseMs = startMs === null
      ? AppUtils.shiftDate(
        new Date(Date.UTC(2026, 2, 20, 18, 0, 0, 0)),
        SEED_SCHEDULE_REFERENCE_DATE,
        environment.bootstrapOffsetInDays
      ).getTime()
      : startMs + eventFeedbackUnlockDelayMs;
    const offsetMinutes = 45 + (seed % 180);
    return new Date(baseMs + (offsetMinutes * 60 * 1000)).toISOString();
  }

  private static seededOrganizerNote(card: SeedEventFeedbackCardRecord, seed: number): string {
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

  private static seededTraitIds(card: SeedEventFeedbackCardRecord, seed: number): string[] {
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

  private static eventStartAtMs(record: ActivityEventRecord | null | undefined): number | null {
    const iso = record?.startAtIso?.trim() ?? '';
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  private static feedbackHostUserForEvent(
    record: ActivityEventRecord,
    users: readonly UserRecord[],
    activeUser: UserRecord
  ): UserRecord {
    const creatorUserId = record.creatorUserId?.trim() ?? '';
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
    const index = AppUtils.hashText(`feedback-host:${record.id}`) % candidates.length;
    return candidates[index] ?? candidates[0];
  }

  private static feedbackAttendeesForEvent(
    record: ActivityEventRecord,
    hostId: string,
    users: readonly UserRecord[],
    activeUserId: string
  ): UserRecord[] {
    const attendeeIds = [...new Set([
      ...(record.acceptedMemberUserIds ?? []),
      ...(record.pendingMemberUserIds ?? [])
    ].map(userId => `${userId}`.trim()).filter(Boolean))]
      .filter(userId => userId !== activeUserId && userId !== hostId);
    if (attendeeIds.length > 0) {
      const usersById = new Map(users.map(user => [user.id, user]));
      const resolved = attendeeIds
        .map(userId => usersById.get(userId))
        .filter((user): user is UserRecord => Boolean(user));
      if (resolved.length > 0) {
        return resolved.slice(0, Math.min(5, resolved.length));
      }
    }

    const candidates = users.filter(user => user.id !== activeUserId && user.id !== hostId);
    if (candidates.length === 0) {
      return [];
    }
    const seed = AppUtils.hashText(`feedback-attendees:${record.id}`);
    const desired = Math.min(candidates.length, 3 + (seed % 4));
    const picked: UserRecord[] = [];
    for (let index = 0; index < candidates.length && picked.length < desired; index += 1) {
      const candidate = candidates[(seed + (index * 3)) % candidates.length];
      if (!candidate || candidate.id === activeUserId || picked.some(item => item.id === candidate.id)) {
        continue;
      }
      picked.push(candidate);
    }
    return picked;
  }

  private static feedbackRoleForAttendee(eventId: string, attendeeUserId: string): ActivityMemberRole {
    const seed = AppUtils.hashText(`feedback-role:${eventId}:${attendeeUserId}`);
    if (seed % 11 === 0) {
      return 'Admin';
    }
    if (seed % 4 === 0) {
      return 'Manager';
    }
    return 'Member';
  }

  private static isEventAdminRecord(record: ActivityEventRecord, userId: string): boolean {
    const normalizedUserId = `${userId ?? ''}`.trim();
    if (!normalizedUserId) {
      return false;
    }
    return record.creatorUserId?.trim() === normalizedUserId
      || (record.adminIds ?? []).some(adminId => adminId.trim() === normalizedUserId);
  }
}
