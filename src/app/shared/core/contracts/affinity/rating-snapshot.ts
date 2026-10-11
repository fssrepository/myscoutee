import { ratingAverage, type RatingCriteriaDefinition, type RatingSnapshot } from '@fssrepository/myscoutee-components';

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
export function ratingCriteriaFor(domain: string | null | undefined): RatingCriteriaDefinition | undefined {
  return domain ? RATING_DOMAINS[domain as RatingDomain] : undefined;
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
