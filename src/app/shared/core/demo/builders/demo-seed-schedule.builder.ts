import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';

export class DemoSeedScheduleBuilder {
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly REFERENCE_DATE = new Date(2026, 1, 18, 0, 0, 0, 0);

  static anchorDate(): Date {
    const now = new Date(Date.now());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const offsetDays = Math.trunc(Number(environment.bootstrapOffsetInDays) || 0);
    return new Date(today.getTime() + (offsetDays * this.DAY_MS));
  }

  static rebaseDateTime(value: string | Date | null | undefined): string | undefined {
    const parsed = this.parseDateTime(value);
    if (!parsed) {
      return undefined;
    }
    return AppUtils.toIsoDateTimeLocal(this.shiftDate(parsed));
  }

  static rebaseDateOnly(value: string | Date | null | undefined): string | undefined {
    const parsed = this.parseDateTime(value);
    if (!parsed) {
      return undefined;
    }
    return AppUtils.toIsoDate(this.shiftDate(parsed));
  }

  static shiftDate(value: Date): Date {
    return new Date(this.anchorDate().getTime() + (value.getTime() - this.REFERENCE_DATE.getTime()));
  }

  static buildDeterministicStartDate(seed: number, index: number): Date {
    const normalizedSeed = Math.max(0, Math.trunc(seed));
    const normalizedIndex = Math.max(0, Math.trunc(index));
    const daysFromAnchor = (normalizedSeed + (normalizedIndex * 11)) % 42;
    const start = new Date(this.anchorDate().getTime() + (daysFromAnchor * this.DAY_MS));
    start.setHours(
      9 + ((normalizedSeed >> 3) % 10),
      ((normalizedSeed >> 7) % 4) * 15,
      0,
      0
    );
    return start;
  }

  static parseDateTime(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value);
    }
    if (!value?.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

}
