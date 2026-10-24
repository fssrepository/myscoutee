import type { UserImpressionsSectionDto } from '../../../contracts/accounts/user.interface';

export class UserImpressionsBuilder {
  static hasImpressionsSectionData(section: UserImpressionsSectionDto | undefined): boolean {
    if (!section) {
      return false;
    }
    const hasPositiveMetric = [
      section.averageRating,
      section.peopleMet,
      section.totalEvents,
      section.repeatCount,
      section.noShowCount
    ].some(value => Number.isFinite(value) && Number(value) > 0);
    const hasBadges = [
      section.vibeBadges,
      section.personalityBadges,
      section.categoryBadges
    ].some(items => (items ?? []).some(item => item.trim().length > 0));
    const hasTraits = (section.personalityTraits ?? []).some(trait =>
      `${trait.id ?? trait.label ?? ''}`.trim().length > 0
      && (
        (Number.isFinite(trait.percent) && Number(trait.percent) > 0)
        || (Number.isFinite(trait.evidenceCount) && Number(trait.evidenceCount) > 0)
      )
    );
    return hasPositiveMetric || hasBadges || hasTraits;
  }
}
