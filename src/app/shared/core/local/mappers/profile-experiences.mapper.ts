import type { ExperienceEntry } from '../../contracts/profile.interface';

export class LocalProfileExperiencesMapper {
  static toEntry(entry: ExperienceEntry | null | undefined): ExperienceEntry | null {
    const id = `${entry?.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    return {
      id,
      type: this.normalizeType(entry?.type),
      title: `${entry?.title ?? ''}`.trim(),
      org: `${entry?.org ?? ''}`.trim(),
      city: `${entry?.city ?? ''}`.trim(),
      dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
      dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
      description: `${entry?.description ?? ''}`.trim()
    };
  }

  static toEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries
      .map(entry => this.toEntry(entry))
      .filter((entry): entry is ExperienceEntry => Boolean(entry));
  }

  static cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }

  private static normalizeType(value: ExperienceEntry['type'] | null | undefined): ExperienceEntry['type'] {
    if (value === 'School' || value === 'Online Session' || value === 'Additional Project') {
      return value;
    }
    return 'Workspace';
  }
}
