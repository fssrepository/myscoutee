import type { ActivitiesView } from './core/contracts';
import type { ActivityListRow } from './core/base/models';
import type { AssetMemberRequestDTO } from './core/base/dto';
import type { UserDto } from './core/contracts/user.interface';

export class AppUtils {
  static cloneMapItems<T extends object>(input: Record<string, T[]>): Record<string, T[]> {
    const output: Record<string, T[]> = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = value.map(item => ({ ...item }));
    }
    return output;
  }

  static normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  static initialsFromText(value: string): string {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'U';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }

  static hasText(value: string | null | undefined, minLength = 1): boolean {
    return (value?.trim().length ?? 0) >= Math.max(0, Math.trunc(minLength));
  }

  static hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  static firstImageUrl(images: readonly string[] | undefined | null): string {
    return (images ?? [])
      .map(image => `${image ?? ''}`.trim())
      .find(image => image.length > 0) ?? '';
  }

  static uniqueTrimmedStrings(values: Iterable<string | null | undefined> | null | undefined): string[] {
    return Array.from(new Set(
      Array.from(values ?? [])
        .map(value => `${value ?? ''}`.trim())
        .filter(Boolean)
    ));
  }

  static enumValue<T extends string>(
    value: string | null | undefined,
    values: readonly T[],
    fallback: T
  ): T {
    return this.enumValueOrNull(value, values) ?? fallback;
  }

  static enumValueOrNull<T extends string>(
    value: string | null | undefined,
    values: readonly T[]
  ): T | null {
    const normalized = `${value ?? ''}`.trim();
    return (values as readonly string[]).includes(normalized) ? normalized as T : null;
  }

  static pad2(value: number): string {
    return `${value}`.padStart(2, '0');
  }

  static fromIsoDate(value: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  static parseDate(value: string | number | Date | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  static dateTimeMs(value: string | number | Date | null | undefined): number | null {
    return this.parseDate(value)?.getTime() ?? null;
  }

  static shortMonthDayLabel(value: Date): string {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  static weekdayMonthDayLabel(value: Date): string {
    return value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  static weekdayMonthDayYearLabel(value: Date): string {
    return value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  static clockTimeLabel(value: Date): string {
    return value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  static dateTimeRangeLabel(
    startIso: string | null | undefined,
    endIso: string | null | undefined,
    fallback = 'Date unavailable',
    defaultDurationMs = 2 * 60 * 60 * 1000
  ): string {
    const start = this.parseDate(startIso);
    const end = this.parseDate(endIso);
    if (!start) {
      return fallback;
    }
    const safeEnd = end && end.getTime() > start.getTime()
      ? end
      : new Date(start.getTime() + defaultDurationMs);
    const startDateLabel = this.shortMonthDayLabel(start);
    const startTimeLabel = this.clockTimeLabel(start);
    const endTimeLabel = this.clockTimeLabel(safeEnd);
    if (start.toDateString() === safeEnd.toDateString()) {
      return `${startDateLabel}, ${startTimeLabel} - ${endTimeLabel}`;
    }
    return `${startDateLabel}, ${startTimeLabel} - ${this.shortMonthDayLabel(safeEnd)}, ${endTimeLabel}`;
  }

  static toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static toIsoDateTime(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    const seconds = `${value.getSeconds()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  static toIsoDateTimeLocal(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  static isoLocalDateTimeToDate(value: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  static isoLocalTimePart(value: string): string {
    const parsed = this.isoLocalDateTimeToDate(value);
    if (!parsed) {
      return '12:00';
    }
    const hours = `${parsed.getHours()}`.padStart(2, '0');
    const minutes = `${parsed.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  static applyDatePartToIsoLocal(current: string, date: Date | null): string {
    if (!date) {
      return current;
    }
    const base = this.isoLocalDateTimeToDate(current) ?? new Date();
    const next = new Date(base);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    return this.toIsoDateTimeLocal(next);
  }

  static applyTimePartToIsoLocal(current: string, time: string): string {
    const base = this.isoLocalDateTimeToDate(current) ?? new Date();
    const [hoursRaw, minutesRaw] = time.split(':');
    const hours = Number.parseInt(hoursRaw ?? '', 10);
    const minutes = Number.parseInt(minutesRaw ?? '', 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return current;
    }
    const next = new Date(base);
    next.setHours(hours, minutes, 0, 0);
    return this.toIsoDateTimeLocal(next);
  }

  static applyTimePartFromDateToIsoLocal(current: string, value: Date | null): string {
    if (!value) {
      return current;
    }
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return this.applyTimePartToIsoLocal(current, `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`);
  }

  static clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  static dateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  static addDays(value: Date, days: number): Date {
    const copy = new Date(value);
    copy.setDate(copy.getDate() + days);
    return this.dateOnly(copy);
  }

  static addMonths(value: Date, months: number): Date {
    const copy = new Date(value.getFullYear(), value.getMonth() + months, 1);
    return this.dateOnly(copy);
  }

  static startOfMonth(value: Date): Date {
    return this.dateOnly(new Date(value.getFullYear(), value.getMonth(), 1));
  }

  static endOfMonth(value: Date): Date {
    return this.dateOnly(new Date(value.getFullYear(), value.getMonth() + 1, 0));
  }

  static startOfWeekMonday(value: Date): Date {
    const copy = this.dateOnly(value);
    const day = copy.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return this.addDays(copy, mondayOffset);
  }

  static endOfWeekSunday(value: Date): Date {
    return this.addDays(this.startOfWeekMonday(value), 6);
  }

  static isoWeekNumber(date: Date): number {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  static activityGroupLabel(
    row: ActivityListRow,
    activitiesView: ActivitiesView,
    labels: { dateUnavailable: string; weekPrefix: string }
  ): string {
    if (activitiesView === 'distance') {
      const distanceMeters = Number.isFinite(row.distanceMetersExact)
        ? Math.max(0, Math.trunc(Number(row.distanceMetersExact)))
        : 0;
      const bucket = Math.max(5, Math.ceil(distanceMeters / 5000) * 5);
      return `${bucket} km`;
    }
    const parsed = new Date(row.dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return labels.dateUnavailable;
    }
    if (activitiesView === 'day') {
      return this.smartListDayLabel(parsed);
    }
    if (activitiesView === 'month') {
      return parsed.toLocaleDateString(this.browserLocale(), { month: 'long', year: 'numeric' });
    }
    return `${labels.weekPrefix} ${this.isoWeekNumber(parsed)}, ${parsed.getFullYear()}`;
  }

  static smartListDayLabel(value: Date): string {
    return value.toLocaleDateString(this.browserLocale(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  static browserLocale(): string | string[] | undefined {
    if (typeof navigator === 'undefined') {
      return undefined;
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : (navigator.language || undefined);
  }

  static findUserByName(users: UserDto[], name: string): UserDto | undefined {
    const target = this.normalizeText(name);
    return users.find(user => this.normalizeText(user.name) === target);
  }

  static resolveAssetRequestUserId(request: AssetMemberRequestDTO, users: UserDto[]): string {
    if (request.userId) {
      return request.userId;
    }
    const matchedUser =
        users.find(user => user.name === request.name && user.initials === request.initials)
        ?? users.find(user => user.name === request.name)
        ?? null;
    return matchedUser?.id ?? request.id;
  }

  static buildMonthAnchorWindow(focusMonth: Date, radius: number): Date[] {
    const anchors: Date[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      anchors.push(this.addMonths(focusMonth, offset));
    }
    return anchors;
  }

  static buildWeekAnchorWindow(focusWeek: Date, radius: number): Date[] {
    const anchors: Date[] = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      anchors.push(this.addDays(focusWeek, offset * 7));
    }
    return anchors;
  }

  static fromYearMonth(value: string): Date | null {
    if (!value || value === 'Present') {
      return null;
    }
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = match[3] ? Number.parseInt(match[3], 10) : 1;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  static toYearMonth(value: Date | null): string {
    if (!value) {
      return '';
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  static toSortableDate(value: string): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }
    const safe = value.replace(/\//g, '-');

    // Support full ISO date-time values directly (e.g. 2026-02-25T12:34:56).
    const direct = new Date(safe);
    if (!Number.isNaN(direct.getTime())) {
      return direct.getTime();
    }

    // Fallback for date-only and year-month values used in the app.
    if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
      return new Date(`${safe}T00:00:00`).getTime();
    }
    if (/^\d{4}-\d{2}$/.test(safe)) {
      return new Date(`${safe}-01T00:00:00`).getTime();
    }
    return Number.POSITIVE_INFINITY;
  }

  static ageFromIsoDate(value: string, fallbackAge: number): number {
    const birthday = this.fromIsoDate(value);
    if (!birthday) {
      return fallbackAge;
    }
    const now = new Date();
    let age = now.getFullYear() - birthday.getFullYear();
    const monthDiff = now.getMonth() - birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
      age -= 1;
    }
    return age;
  }

  static horoscopeByDate(value: Date): string {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
    return 'Capricorn';
  }

  static withContextIconItems(summary: string, iconMap: Record<string, string>): string[] {
    return summary
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        const key = Object.keys(iconMap).find(label => trimmed.startsWith(label));
        return key ? `${iconMap[key]} ${trimmed}` : trimmed;
      });
  }

  static badgeItemsLength(items: string[]): number {
    return items.reduce((sum, item) => sum + item.length, 0);
  }
}
