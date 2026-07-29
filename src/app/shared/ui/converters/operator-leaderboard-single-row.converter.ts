import type { OperatorLeaderboardEntryDto } from '../../core/contracts/operator.interface';
import type {
  SingleRowBadge,
  SingleRowData
} from '../components/core/smart-list/card/card.types';
import type {
  ConverterOptionsArg,
  UiConverter
} from './converter.types';

export interface OperatorLeaderboardSingleRowConverterOptions {
  locale?: string | null;
  shareLabel?: string | null;
  unitsLabel?: string | null;
  deploymentLabel?: string | null;
  deploymentsLabel?: string | null;
  claimedNodeLabel?: string | null;
  unclaimedNodeLabel?: string | null;
  pendingReviewLabel?: string | null;
  rejectedReviewLabel?: string | null;
  suspendedEligibilityLabel?: string | null;
  partiallySuspendedEligibilityLabel?: string | null;
  inactiveEligibilityLabel?: string | null;
}

export class OperatorLeaderboardSingleRowConverter implements UiConverter<
  OperatorLeaderboardEntryDto,
  SingleRowData<OperatorLeaderboardEntryDto>,
  OperatorLeaderboardSingleRowConverterOptions | undefined
> {
  convert(
    entry: OperatorLeaderboardEntryDto,
    ...optionsArg: ConverterOptionsArg<OperatorLeaderboardSingleRowConverterOptions | undefined>
  ): SingleRowData<OperatorLeaderboardEntryDto> {
    const options = optionsArg[0] ?? {};
    const locale = `${options.locale ?? ''}`.trim() || undefined;
    const units = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0
    }).format(Math.max(0, entry.verifiedWeight));
    const share = new Intl.NumberFormat(locale, {
      minimumFractionDigits: entry.sharePercent > 0 && entry.sharePercent < 1 ? 2 : 1,
      maximumFractionDigits: 2
    }).format(Math.max(0, entry.sharePercent));
    const claimantName = `${entry.claimantName ?? ''}`.trim();
    const shareLabel = `${options.shareLabel ?? ''}`.trim() || 'share';
    const unitsLabel = `${options.unitsLabel ?? ''}`.trim() || 'contribution units';
    const deploymentCount = Math.max(1, Math.trunc(Number(entry.deploymentCount) || 1));
    const deploymentLabel = deploymentCount === 1
      ? `${options.deploymentLabel ?? ''}`.trim() || 'deployment'
      : `${options.deploymentsLabel ?? ''}`.trim() || 'deployments';
    const claimedNodeLabel = `${options.claimedNodeLabel ?? ''}`.trim();
    const unclaimedNodeLabel = `${options.unclaimedNodeLabel ?? ''}`.trim();
    const pendingReview = entry.claimVerificationStatus === 'PENDING_REVIEW';
    const pendingReviewLabel = `${options.pendingReviewLabel ?? ''}`.trim()
      || 'Under review';
    const rejectedReview = entry.claimVerificationStatus === 'REJECTED';
    const rejectedReviewLabel = `${options.rejectedReviewLabel ?? ''}`.trim()
      || 'Review rejected';
    const suspended = entry.group === 'CLAIMED'
      && entry.eligibilityStatus === 'SUSPENDED';
    const partiallySuspended = entry.group === 'CLAIMED'
      && entry.eligibilityStatus === 'PARTIALLY_SUSPENDED';
    const inactive = entry.group === 'CLAIMED'
      && entry.eligibilityStatus === 'INACTIVE';
    const suspendedEligibilityLabel = `${
      options.suspendedEligibilityLabel ?? ''
    }`.trim() || 'Suspended';
    const partiallySuspendedEligibilityLabel = `${
      options.partiallySuspendedEligibilityLabel ?? ''
    }`.trim() || 'Partially suspended';
    const inactiveEligibilityLabel = `${
      options.inactiveEligibilityLabel ?? ''
    }`.trim() || 'Not eligible';
    const shareBadge: SingleRowBadge = {
      label: `${share}%`,
      icon: 'pie_chart',
      ariaLabel: `${share}% ${shareLabel}`,
      title: `${share}% ${shareLabel}`,
      tone: entry.sharePercent > 0 ? 'accent' : 'muted',
      position: 'top-right'
    };
    const badges: SingleRowBadge[] = rejectedReview
      ? [{
          label: rejectedReviewLabel,
          icon: 'block',
          ariaLabel: rejectedReviewLabel,
          title: rejectedReviewLabel,
          tone: 'danger',
          position: 'top-right'
        }]
      : pendingReview
        ? [{
            label: pendingReviewLabel,
            icon: 'pending_actions',
            ariaLabel: pendingReviewLabel,
            title: pendingReviewLabel,
            tone: 'warning',
            position: 'top-right'
          }, shareBadge]
        : suspended
          ? [{
              label: suspendedEligibilityLabel,
              icon: 'pause_circle',
              ariaLabel: suspendedEligibilityLabel,
              title: suspendedEligibilityLabel,
              tone: 'danger',
              position: 'top-right'
            }, shareBadge]
          : partiallySuspended
            ? [{
                label: partiallySuspendedEligibilityLabel,
                icon: 'warning',
                ariaLabel: partiallySuspendedEligibilityLabel,
                title: partiallySuspendedEligibilityLabel,
                tone: 'warning',
                position: 'top-right'
              }, shareBadge]
            : inactive
              ? [{
                  label: inactiveEligibilityLabel,
                  icon: 'gpp_maybe',
                  ariaLabel: inactiveEligibilityLabel,
                  title: inactiveEligibilityLabel,
                  tone: 'muted',
                  position: 'top-right'
                }]
              : [shareBadge];

    return {
      id: entry.id,
      title: entry.label,
      subtitle: entry.group === 'CLAIMED'
        ? `${deploymentCount} ${deploymentLabel}`
        : entry.group === 'FOUNDER'
          ? unitsLabel
          : entry.claimed
            ? claimedNodeLabel
            : unclaimedNodeLabel,
      detail: `${units} ${unitsLabel}`,
      avatarUrl: `${entry.claimantAvatarUrl ?? ''}`.trim() || null,
      avatarInitials: claimantName ? this.initials(claimantName) : null,
      avatarAriaLabel: claimantName || entry.label,
      icon: claimantName
        ? null
        : entry.group === 'FOUNDER'
          ? 'favorite'
          : entry.claimed
            ? 'verified'
            : 'dns',
      surfaceTone: entry.group === 'FOUNDER'
        ? 'accent'
        : rejectedReview
          ? 'danger'
          : pendingReview
            ? 'warning'
            : suspended
              ? 'danger'
              : partiallySuspended
                ? 'warning'
                : inactive
                  ? 'muted'
                  : entry.claimed
                    ? 'success'
                    : 'muted',
      toneClass: [
        'operator-leaderboard-row',
        `operator-leaderboard-row--${entry.group.toLowerCase()}`,
        pendingReview ? 'operator-leaderboard-row--pending-review' : '',
        rejectedReview ? 'operator-leaderboard-row--rejected' : '',
        suspended ? 'operator-leaderboard-row--suspended' : '',
        partiallySuspended
          ? 'operator-leaderboard-row--partially-suspended'
          : '',
        inactive ? 'operator-leaderboard-row--inactive' : ''
      ].filter(Boolean).join(' '),
      badges,
      eagerDetail: structuredClone(entry)
    };
  }

  private initials(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
