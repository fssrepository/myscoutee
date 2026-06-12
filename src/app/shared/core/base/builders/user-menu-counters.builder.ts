import type { UserDto, UserMenuCountersDto } from '../../contracts/user.interface';
import { ScheduleDateBuilder } from './schedule-date.builder';

export class UserMenuCountersBuilder {
  static buildInitialMenuCounterOverrides(
    user: UserDto,
    counts: {
      cars: number;
      accommodation: number;
      supplies: number;
      tickets: number;
      contacts: number;
      feedback: number;
    }
  ): UserMenuCountersDto {
    const normalizeCounter = (value: unknown): number => {
      const count = Number(value);
      return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    };

    const activities = user?.activities;
    const events = normalizeCounter(activities?.events);
    const invitations = normalizeCounter(activities?.invitations);
    const hosting = normalizeCounter(activities?.hosting);
    const feedback = normalizeCounter(activities?.feedback);
    const cars = normalizeCounter(counts?.cars ?? activities?.cars);
    const accommodation = normalizeCounter(counts?.accommodation ?? activities?.accommodation);
    const supplies = normalizeCounter(counts?.supplies ?? activities?.supplies);
    const tickets = normalizeCounter(activities?.tickets);
    const event = activities?.event;
    const asset = activities?.asset;
    const eventFeedback = activities?.eventFeedback;

    return {
      game: normalizeCounter(activities?.game),
      chat: normalizeCounter(activities?.chat),
      invitations,
      events,
      hosting,
      cars,
      accommodation,
      supplies,
      tickets,
      contacts: normalizeCounter(activities?.contacts),
      feedback,
      event: {
        all: normalizeCounter(event?.all ?? events + invitations + hosting),
        active: normalizeCounter(event?.active ?? events),
        pending: normalizeCounter(event?.pending),
        invitations: normalizeCounter(event?.invitations ?? invitations),
        hosting: normalizeCounter(event?.hosting ?? hosting),
        drafts: normalizeCounter(event?.drafts),
        trash: normalizeCounter(event?.trash),
      },
      asset: {
        cars: normalizeCounter(asset?.cars ?? cars),
        accommodation: normalizeCounter(asset?.accommodation ?? accommodation),
        supplies: normalizeCounter(asset?.supplies ?? supplies),
        tickets: normalizeCounter(asset?.tickets ?? tickets),
      },
      eventFeedback: {
        ownEvents: normalizeCounter(eventFeedback?.ownEvents),
        pending: normalizeCounter(eventFeedback?.pending ?? feedback),
        feedbacked: normalizeCounter(eventFeedback?.feedbacked),
        removed: normalizeCounter(eventFeedback?.removed),
      },
      adminJobs: normalizeCounter(activities?.adminJobs),
      adminMetrics: normalizeCounter(activities?.adminMetrics),
    };
  }

  static resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  static syntheticEventActivityTotal(existingCount: number, minEventsPerUser: number): number {
    const normalizedExistingCount = Math.max(0, Math.trunc(existingCount));
    const normalizedMinimum = Math.max(0, Math.trunc(minEventsPerUser));
    const needed = Math.max(0, normalizedMinimum - normalizedExistingCount);
    let total = 0;
    for (let index = 0; index < needed; index += 1) {
      total += (index % 5) + 1;
    }
    return total;
  }

  static syntheticPendingEventFeedbackCount(
    existingCount: number,
    minEventsPerUser: number,
    nowMs: number,
    unlockDelayMs: number
  ): number {
    const normalizedExistingCount = Math.max(0, Math.trunc(existingCount));
    const normalizedMinimum = Math.max(0, Math.trunc(minEventsPerUser));
    const normalizedNowMs = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const normalizedUnlockDelayMs = Math.max(0, Math.trunc(unlockDelayMs));
    const needed = Math.max(0, normalizedMinimum - normalizedExistingCount);
    let total = 0;

    for (let index = 0; index < needed; index += 1) {
      const sequence = normalizedExistingCount + index + 1;
      if ((sequence % 4) === 0) {
        continue;
      }
      const startMs = ScheduleDateBuilder
        .shiftDate(new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0))
        .getTime();
      if (normalizedNowMs >= startMs + normalizedUnlockDelayMs) {
        total += 1;
      }
    }

    return total;
  }
}
