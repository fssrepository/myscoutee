import { FeedbackPageResultDto } from '../../../../contracts/feedback/feedback.interface';
import { UiDateUtils } from '@fssrepository/myscoutee-components';
import type { FeedbackStateRecord } from '../../../source/entity/feedback/feedback.entity';
import type { UserRecord } from '../../../source/entity/accounts/user.entity';
import { environment } from '../../../../../../../environments/environment';
import { AppUtils } from '../../../../base/app-utils';
import type { ActivityMemberRole } from '../../../../common/constants';
import type { ActivityEventRecord } from '../../../../contracts/common/activity.interface';
import type { SubmittedFeedbackAnswer } from '../../../../contracts/feedback/feedback.interface';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../../seed-constants';

interface SeedFeedbackOptionRecord {
  value: string;
  impressionTag?: string;
}

interface SeedFeedbackTraitOptionRecord {
  id: string;
}

interface SeedFeedbackCardRecord {
  id: string;
  eventId: string;
  kind: 'event' | 'attendee';
  attendeeUserId?: string;
  targetUserId?: string;
  targetRole?: ActivityMemberRole;
  heading: string;
  primaryOptions: readonly SeedFeedbackOptionRecord[];
  secondaryOptions: readonly SeedFeedbackOptionRecord[];
  traitOptions: readonly SeedFeedbackTraitOptionRecord[];
}

interface SeedFeedbackOptionInputs {
  feedbackUnlockDelayMs: number;
  eventOverallOptions: readonly SeedFeedbackOptionRecord[];
  hostImproveOptions: readonly SeedFeedbackOptionRecord[];
  attendeeCollabOptions: readonly SeedFeedbackOptionRecord[];
  attendeeRejoinOptions: readonly SeedFeedbackOptionRecord[];
  personalityTraitOptions: readonly SeedFeedbackTraitOptionRecord[];
}

export class SeedFeedbackBuilder {
  static buildSeededSubmittedState(options: {
    eventRecord: ActivityEventRecord;
    users: readonly UserRecord[];
    activeUser: UserRecord;
    seedKey?: string;
  } & SeedFeedbackOptionInputs): FeedbackStateRecord | null {
    const eventId = options.eventRecord.id?.trim() ?? '';
    if (!eventId) {
      return null;
    }

    const eventCards = this.buildFeedbackCards({
      eventRecords: [options.eventRecord],
      users: options.users,
      activeUser: options.activeUser,
      feedbackUnlockDelayMs: options.feedbackUnlockDelayMs,
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
      options.feedbackUnlockDelayMs,
      seed
    );
    const answersByCardId: FeedbackStateRecord['answersByCardId'] = {};
    for (const card of eventCards) {
      const answer = this.seededSubmittedAnswer(card, seed, submittedAtIso);
      answersByCardId[answer.cardId] = answer;
    }

    return {
      id: this.feedbackStateRecordId(options.activeUser.id, eventId),
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
  } & SeedFeedbackOptionInputs): FeedbackStateRecord[] {
    const eventRecordsById = new Map(
      options.eventRecords
        .map(record => [record.id?.trim() ?? '', record] as const)
        .filter(([eventId]) => eventId.length > 0)
    );
    const cardsByEventId = new Map<string, SeedFeedbackCardRecord[]>();

    for (const card of this.buildFeedbackCards(options)) {
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
    const states: FeedbackStateRecord[] = [];
    for (const [index, eventId] of orderedEventIds.entries()) {
      const eventRecord = eventRecordsById.get(eventId);
      const eventCards = cardsByEventId.get(eventId) ?? [];
      if (!eventRecord || eventCards.length === 0) {
        continue;
      }
      const seed = AppUtils.hashText(`feedback-state:${options.activeUser.id}:${eventId}`);
      const recordId = this.feedbackStateRecordId(options.activeUser.id, eventId);
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
        options.feedbackUnlockDelayMs,
        seed
      );
      const answersByCardId: FeedbackStateRecord['answersByCardId'] = {};
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

  private static buildFeedbackCards(options: {
    eventRecords: readonly ActivityEventRecord[];
    users: readonly UserRecord[];
    activeUser: UserRecord;
  } & SeedFeedbackOptionInputs): SeedFeedbackCardRecord[] {
    const nowMs = Date.now();
    const eventCards: SeedFeedbackCardRecord[] = [];
    for (const record of options.eventRecords) {
      const eventId = record.id?.trim() ?? '';
      if (!eventId || this.isEventAdminRecord(record, options.activeUser.id)) {
        continue;
      }
      const startMs = this.eventStartAtMs(record);
      if (startMs === null || nowMs < startMs + options.feedbackUnlockDelayMs) {
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
    card: SeedFeedbackCardRecord,
    seed: number,
    submittedAtIso: string
  ): SubmittedFeedbackAnswer {
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
      eventComment: card.kind === 'event' ? 'A welcoming event with a clear shared purpose.' : '',
      personalityTraitIds: this.seededTraitIds(card, seed),
      tags: [...tags],
      submittedAtIso
    };
  }

  private static seededOption(
    options: readonly SeedFeedbackOptionRecord[],
    seedKey: string
  ): SeedFeedbackOptionRecord | null {
    if (options.length === 0) {
      return null;
    }
    const index = AppUtils.hashText(seedKey) % options.length;
    return options[index] ?? options[0] ?? null;
  }

  private static seededSubmittedAtIso(
    eventRecord: ActivityEventRecord,
    feedbackUnlockDelayMs: number,
    seed: number
  ): string {
    const startMs = this.eventStartAtMs(eventRecord);
    const baseMs = startMs === null
      ? UiDateUtils.shiftDate(
        new Date(Date.UTC(2026, 2, 20, 18, 0, 0, 0)),
        SEED_SCHEDULE_REFERENCE_DATE,
        environment.bootstrapOffsetInDays
      ).getTime()
      : startMs + feedbackUnlockDelayMs;
    const offsetMinutes = 45 + (seed % 180);
    return new Date(baseMs + (offsetMinutes * 60 * 1000)).toISOString();
  }

  private static seededOrganizerNote(card: SeedFeedbackCardRecord, seed: number): string {
    const noteTemplates = [
      `Strong overall flow for ${card.heading}. I would tighten the timing at the start next round.`,
      `The vibe was good around ${card.heading}. A clearer check-in and role handoff would help next time.`,
      `Good energy on ${card.heading}. I would make the pacing a bit smoother between sections.`
    ] as const;
    return noteTemplates[seed % noteTemplates.length] ?? noteTemplates[0];
  }

  private static feedbackStateRecordId(userId: string, eventId: string): string {
    return `${userId.trim()}::${eventId.trim()}`;
  }

  private static seededTraitIds(card: SeedFeedbackCardRecord, seed: number): string[] {
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

  private static feedbackAttendeesForEvent(record: ActivityEventRecord, hostId: string, users: readonly UserRecord[], activeUserId: string): UserRecord[] {
    return FeedbackPageResultDto.feedbackAttendeesForEvent(record, hostId, users, activeUserId);
  }

  private static feedbackRoleForAttendee(eventId: string, attendeeUserId: string): ActivityMemberRole {
    return FeedbackPageResultDto.feedbackRoleForAttendee(eventId, attendeeUserId);
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
