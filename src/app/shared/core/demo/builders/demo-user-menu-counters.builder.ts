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

  private static normalizeCounterValue(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }
}
