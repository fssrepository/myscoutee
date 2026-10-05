/** Supplemental, actor-owned detail captured with a rating. Matching uses the existing scalar score. */
export interface RatingSnapshot {
  version: 1;
  profileType: string;
  criteria: Record<string, number>;
  average: number;
}

export interface RatingCriteriaDefinition {
  profileType: string;
  criteria: readonly { id: string; label: string }[];
}

export type RatingDomain = 'dating' | 'dating-pair' | 'campaign' | 'work' | 'service-interest' | 'service';

/** Profile product configuration, independent of user permissions and admin roles. */
export const DATING_RATING_CRITERIA: RatingCriteriaDefinition = {
  profileType: 'dating',
  criteria: [
    { id: 'attraction', label: 'rating.criteria.attraction' },
    { id: 'personality', label: 'rating.criteria.personality' },
    { id: 'interests', label: 'rating.criteria.interests' },
    { id: 'values', label: 'rating.criteria.values' }
  ]
};

export const SERVICE_RATING_CRITERIA: RatingCriteriaDefinition = {
  profileType: 'service',
  criteria: ['quality','reliability','communication','value'].map(id => ({id,label:`rating.criteria.service.${id}`}))
};

const criteriaFor = (profileType: RatingDomain, ids: readonly string[]): RatingCriteriaDefinition => ({
  profileType, criteria: ids.map(id => ({ id, label: `rating.criteria.${profileType}.${id}` }))
});
const RATING_DOMAINS: Record<RatingDomain, RatingCriteriaDefinition> = {
  dating: DATING_RATING_CRITERIA,
  'dating-pair': criteriaFor('dating-pair', ['chemistry', 'interests', 'values', 'compatibility']),
  campaign: criteriaFor('campaign', ['relevance', 'appeal', 'clarity', 'collaboration']),
  work: criteriaFor('work', ['fit', 'interests', 'communication', 'collaboration']),
  'service-interest': criteriaFor('service-interest', ['relevance', 'clarity', 'confidence', 'value']),
  service: SERVICE_RATING_CRITERIA
};

/** The evaluated card supplies its domain. The active workspace is not a rating subject. */
export function ratingCriteriaFor(domain: RatingDomain | null | undefined): RatingCriteriaDefinition | undefined {
  return domain ? RATING_DOMAINS[domain] : undefined;
}

export function validRatingSnapshot(snapshot: RatingSnapshot | undefined, score: number): boolean {
  if (!snapshot) return true;
  const definition = ratingCriteriaFor(snapshot.profileType as RatingDomain);
  if (!definition || snapshot.version !== 1 || !snapshot.criteria) return false;
  const keys = definition.criteria.map(c => c.id), values = keys.map(key => snapshot.criteria[key]);
  return Object.keys(snapshot.criteria).length === keys.length
    && values.every(value => Number.isInteger(value) && value >= 1 && value <= 10)
    && Math.abs(ratingAverage(values) - snapshot.average) < 0.000001
    && Math.abs(snapshot.average - score) < 0.000001;
}

export function ratingAverage(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

/** Shift whole-number criteria together; distribute residual units to retain the nearest achievable mean. */
export function shiftRatingCriteria(values: readonly number[], average: number, min = 1, max = 10): number[] {
  if (!values.length) return [];
  const target = Math.round(Math.min(max, Math.max(min, average)) * values.length) / values.length;
  let low = min - max;
  let high = max - min;
  for (let index = 0; index < 48; index++) {
    const delta = (low + high) / 2;
    const mean = ratingAverage(values.map(value => Math.min(max, Math.max(min, value + delta))));
    if (mean < target) low = delta;
    else high = delta;
  }
  const ticks = values.map(value => Math.floor(Math.min(max, Math.max(min, value + high))));
  let remaining = Math.round(target * values.length) - ticks.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % ticks.length) {
    if (ticks[index] < max) { ticks[index]++; remaining--; }
  }
  return ticks;
}
