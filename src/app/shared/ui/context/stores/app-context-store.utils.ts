import type { HelpCenterRevisionDto, HelpCenterStateDto } from '../../../core/contracts';
import type { UserGameFilterPreferencesDto } from '../../../core/contracts/activity.interface';
import type { ProfileExtDto, UserDto, UserImpressionsDto, UserImpressionsSectionDto } from '../../../core/contracts/user.interface';
import type {
  ActivityAssetCounters,
  ActivityEventCounters,
  ActivityEventFeedbackCounters
} from './activity.store';
import type { UserProfileAdminUserDto } from './user-profile.store';

export function normalizeCounterValue(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(Number(value)));
}

export function normalizeFilterPreferences(
  preferences: UserGameFilterPreferencesDto
): UserGameFilterPreferencesDto {
  const normalizeNumber = (value: unknown): number | undefined => {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(0, Math.trunc(Number(value)));
  };
  const normalizeStringArray = (values: unknown): string[] | undefined => {
    if (!Array.isArray(values)) {
      return undefined;
    }
    const normalized = values
      .map(value => String(value).trim())
      .filter(value => value.length > 0);
    return normalized.length > 0 ? normalized : [];
  };
  const normalizeGenderArray = (values: unknown): Array<'woman' | 'man'> | undefined => {
    if (!Array.isArray(values)) {
      return undefined;
    }
    const normalized = values
      .map(value => String(value).trim().toLowerCase())
      .filter((value): value is 'woman' | 'man' => value === 'woman' || value === 'man');
    return normalized.length > 0 ? normalized : [];
  };

  const normalized: UserGameFilterPreferencesDto = {};
  const ageMin = normalizeNumber(preferences.ageMin);
  const ageMax = normalizeNumber(preferences.ageMax);
  const heightMinCm = normalizeNumber(preferences.heightMinCm);
  const heightMaxCm = normalizeNumber(preferences.heightMaxCm);
  if (ageMin !== undefined) {
    normalized.ageMin = ageMin;
  }
  if (ageMax !== undefined) {
    normalized.ageMax = ageMax;
  }
  if (heightMinCm !== undefined) {
    normalized.heightMinCm = heightMinCm;
  }
  if (heightMaxCm !== undefined) {
    normalized.heightMaxCm = heightMaxCm;
  }

  const interests = normalizeStringArray(preferences.interests);
  const values = normalizeStringArray(preferences.values);
  const physiques = normalizeStringArray(preferences.physiques);
  const languages = normalizeStringArray(preferences.languages);
  const genders = normalizeGenderArray(preferences.genders);
  const horoscopes = normalizeStringArray(preferences.horoscopes);
  const traitLabels = normalizeStringArray(preferences.traitLabels);
  const smoking = normalizeStringArray(preferences.smoking);
  const drinking = normalizeStringArray(preferences.drinking);
  const workout = normalizeStringArray(preferences.workout);
  const pets = normalizeStringArray(preferences.pets);
  const familyPlans = normalizeStringArray(preferences.familyPlans);
  const children = normalizeStringArray(preferences.children);
  const loveStyles = normalizeStringArray(preferences.loveStyles);
  const communicationStyles = normalizeStringArray(preferences.communicationStyles);
  const sexualOrientations = normalizeStringArray(preferences.sexualOrientations);
  const religions = normalizeStringArray(preferences.religions);

  if (interests) {
    normalized.interests = interests;
  }
  if (values) {
    normalized.values = values;
  }
  if (physiques) {
    normalized.physiques = physiques;
  }
  if (languages) {
    normalized.languages = languages;
  }
  if (genders) {
    normalized.genders = genders;
  }
  if (horoscopes) {
    normalized.horoscopes = horoscopes;
  }
  if (traitLabels) {
    normalized.traitLabels = traitLabels;
  }
  if (smoking) {
    normalized.smoking = smoking;
  }
  if (drinking) {
    normalized.drinking = drinking;
  }
  if (workout) {
    normalized.workout = workout;
  }
  if (pets) {
    normalized.pets = pets;
  }
  if (familyPlans) {
    normalized.familyPlans = familyPlans;
  }
  if (children) {
    normalized.children = children;
  }
  if (loveStyles) {
    normalized.loveStyles = loveStyles;
  }
  if (communicationStyles) {
    normalized.communicationStyles = communicationStyles;
  }
  if (sexualOrientations) {
    normalized.sexualOrientations = sexualOrientations;
  }
  if (religions) {
    normalized.religions = religions;
  }

  return normalized;
}

export function cloneImpressions(impressions: UserImpressionsDto): UserImpressionsDto {
  return {
    host: cloneImpressionsSection(impressions.host),
    member: cloneImpressionsSection(impressions.member)
  };
}

export function cloneProfileExt(profileExt: ProfileExtDto): ProfileExtDto {
  return {
    profile: cloneUserProfile(profileExt.profile),
    experienceEntries: (profileExt.experienceEntries ?? []).map(entry => ({ ...entry }))
  };
}

export function cloneUserProfile(user: UserDto): UserDto {
  return {
    ...user,
    languages: [...(user.languages ?? [])],
    images: [...(user.images ?? [])],
    profileDetails: cloneProfileDetails(user.profileDetails),
    activities: {
      game: user.activities?.game ?? 0,
      chat: user.activities?.chat ?? 0,
      invitations: user.activities?.invitations ?? 0,
      events: user.activities?.events ?? 0,
      hosting: user.activities?.hosting ?? 0,
      cars: user.activities?.cars ?? 0,
      accommodation: user.activities?.accommodation ?? 0,
      supplies: user.activities?.supplies ?? 0,
      tickets: user.activities?.tickets ?? 0,
      contacts: user.activities?.contacts ?? 0,
      feedback: user.activities?.feedback ?? 0,
      event: cloneEventCounters(user.activities?.event),
      asset: cloneAssetCounters(user.activities?.asset),
      eventFeedback: cloneEventFeedbackCounters(user.activities?.eventFeedback),
      adminJobs: user.activities?.adminJobs ?? 0,
      adminMetrics: user.activities?.adminMetrics ?? 0
    },
    impressions: user.impressions ? cloneImpressions(user.impressions) : undefined
  };
}

export function adminUserFromProfile(profile: UserDto | null): UserProfileAdminUserDto | null {
  const id = `${profile?.id ?? ''}`.trim();
  if (!id || !profile) {
    return null;
  }
  const name = `${profile.name ?? ''}`.trim() || 'Admin';
  return {
    id,
    name,
    initials: `${profile.initials ?? ''}`.trim() || 'AD',
    email: `${id}@myscoutee.local`,
    headline: profile.headline ?? null,
    about: profile.about ?? null,
    images: [...(profile.images ?? [])]
  };
}

export function cloneEventCounters(counters: Partial<ActivityEventCounters> | undefined | null): ActivityEventCounters {
  return {
    all: normalizeCounterValue(Number(counters?.all) || 0),
    active: normalizeCounterValue(Number(counters?.active) || 0),
    pending: normalizeCounterValue(Number(counters?.pending) || 0),
    invitations: normalizeCounterValue(Number(counters?.invitations) || 0),
    hosting: normalizeCounterValue(Number(counters?.hosting) || 0),
    drafts: normalizeCounterValue(Number(counters?.drafts) || 0),
    trash: normalizeCounterValue(Number(counters?.trash) || 0)
  };
}

export function cloneAssetCounters(counters: Partial<ActivityAssetCounters> | undefined | null): ActivityAssetCounters {
  return {
    cars: normalizeCounterValue(Number(counters?.cars) || 0),
    accommodation: normalizeCounterValue(Number(counters?.accommodation) || 0),
    supplies: normalizeCounterValue(Number(counters?.supplies) || 0),
    tickets: normalizeCounterValue(Number(counters?.tickets) || 0)
  };
}

export function cloneEventFeedbackCounters(
  counters: Partial<ActivityEventFeedbackCounters> | undefined | null
): ActivityEventFeedbackCounters {
  return {
    ownEvents: normalizeCounterValue(Number(counters?.ownEvents) || 0),
    pending: normalizeCounterValue(Number(counters?.pending) || 0),
    feedbacked: normalizeCounterValue(Number(counters?.feedbacked) || 0),
    removed: normalizeCounterValue(Number(counters?.removed) || 0)
  };
}

export function cloneHelpCenterState(state: HelpCenterStateDto): HelpCenterStateDto {
  return {
    activeRevision: state.activeRevision ? cloneHelpCenterRevision(state.activeRevision) : null,
    revisions: state.revisions.map(revision => cloneHelpCenterRevision(revision)),
    auditTrail: state.auditTrail.map(entry => ({ ...entry })),
    availableLanguages: state.availableLanguages.map(language => ({ ...language }))
  };
}

export function cloneHelpCenterRevision(revision: HelpCenterRevisionDto): HelpCenterRevisionDto {
  return {
    ...revision,
    sections: revision.sections.map(section => ({
      ...section,
      imageUrls: [...(section.imageUrls ?? [])],
      details: [...(section.details ?? [])],
      points: [...(section.points ?? [])]
    }))
  };
}

function cloneImpressionsSection(
  section: UserImpressionsSectionDto | undefined
): UserImpressionsSectionDto | undefined {
  if (!section) {
    return undefined;
  }
  return {
    ...section,
    vibeBadges: [...(section.vibeBadges ?? [])],
    personalityBadges: [...(section.personalityBadges ?? [])],
    personalityTraits: (section.personalityTraits ?? []).map(trait => ({ ...trait })),
    categoryBadges: [...(section.categoryBadges ?? [])]
  };
}

function cloneProfileDetails(groups: UserDto['profileDetails']): UserDto['profileDetails'] {
  if (!groups) {
    return undefined;
  }
  return groups.map(group => ({
    title: `${group.title ?? ''}`,
    rows: (group.rows ?? []).map(row => ({
      labelKey: `${row.labelKey ?? ''}`,
      value: `${row.value ?? ''}`,
      privacy: row.privacy,
      options: [...(row.options ?? [])]
    }))
  }));
}
