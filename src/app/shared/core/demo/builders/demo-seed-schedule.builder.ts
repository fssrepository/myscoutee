import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';

export class DemoSeedScheduleBuilder {
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly REFERENCE_DATE = new Date(2026, 1, 18, 0, 0, 0, 0);

  static anchorDate(): Date {
    const configuredAnchor = this.parseConfiguredAnchorDate(environment.demoSeedScheduleAnchorDateIso);
    if (configuredAnchor) {
      return configuredAnchor;
    }
    const now = new Date(Date.now());
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
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

  private static parseConfiguredAnchorDate(value: string | null | undefined): Date | null {
    const rawValue = `${value ?? ''}`.trim();
    if (!rawValue) {
      return null;
    }
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const monthIndex = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      const parsed = new Date(year, monthIndex, day, 0, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return this.parseDateTime(rawValue);
  }
}
