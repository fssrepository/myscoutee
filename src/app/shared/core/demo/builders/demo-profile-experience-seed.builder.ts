import type { ExperienceEntry } from '../../base/models/profile.model';

type DemoProfileExperienceSeedRecord = Record<string, ExperienceEntry[]>;

const ALEX_TURNER_DEMO_USER_ID = 'u20';

const ALEX_TURNER_EXPERIENCE_ENTRIES: ExperienceEntry[] = [
  {
    id: 'alex-turner-school-portland-state',
    type: 'School',
    title: 'BA Community Management',
    org: 'Portland State University',
    city: 'Portland',
    dateFrom: '2013-09',
    dateTo: '2017-06',
    description: 'Studied community programs, group facilitation, and nonprofit operations.'
  },
  {
    id: 'alex-turner-work-bridge-beam',
    type: 'Workspace',
    title: 'Event Operations Coordinator',
    org: 'Bridge & Beam Studio',
    city: 'Portland',
    dateFrom: '2018-01',
    dateTo: '2021-04',
    description: 'Coordinated small-format cultural events, vendor timing, and member follow-up.'
  },
  {
    id: 'alex-turner-project-supper-club',
    type: 'Additional Project',
    title: 'Neighborhood Supper Club',
    org: 'Independent Project',
    city: 'Portland',
    dateFrom: '2021-06',
    dateTo: 'Present',
    description: 'Runs rotating food, books, and theatre meetups with curated guest lists.'
  }
];

export class DemoProfileExperienceSeedBuilder {
  static buildSeededExperiencesByUserId(): DemoProfileExperienceSeedRecord {
    return {
      [ALEX_TURNER_DEMO_USER_ID]: this.cloneEntries(ALEX_TURNER_EXPERIENCE_ENTRIES)
    };
  }

  private static cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }
}
