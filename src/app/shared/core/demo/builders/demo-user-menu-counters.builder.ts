import type { UserDto, UserMenuCountersDto } from '../../base/interfaces/user.interface';

export class DemoUserMenuCountersBuilder {
  static buildInitialMenuCounterOverrides(
    user: UserDto,
    counts: { tickets: number; feedback: number }
  ): UserMenuCountersDto {
    return {
      game: this.normalizeCounterValue(user.activities?.game),
      chat: this.normalizeCounterValue(user.activities?.chat),
      invitations: this.normalizeCounterValue(user.activities?.invitations),
      events: this.normalizeCounterValue(user.activities?.events),
      hosting: this.normalizeCounterValue(user.activities?.hosting),
      tickets: this.normalizeCounterValue(counts.tickets),
      feedback: this.normalizeCounterValue(counts.feedback)
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
      const startMs = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0).getTime();
      if (normalizedNowMs >= startMs + normalizedUnlockDelayMs) {
        total += 1;
      }
    }

    return total;
  }

  private static normalizeCounterValue(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}
