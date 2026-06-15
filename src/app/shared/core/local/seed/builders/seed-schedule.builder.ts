import { environment } from '../../../../../../environments/environment';
import { AppUtils } from '../../../../app-utils';

export class SeedScheduleBuilder {
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

  static shiftDate(value: Date): Date {
    return new Date(this.anchorDate().getTime() + (value.getTime() - this.REFERENCE_DATE.getTime()));
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
