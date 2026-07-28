import type { OperatorLeaderboardEntryDto } from '../../core/contracts/operator.interface';
import type { SingleRowData } from '../components/core/smart-list/card/card.types';
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
        : entry.claimed
          ? 'success'
          : 'muted',
      toneClass: `operator-leaderboard-row operator-leaderboard-row--${entry.group.toLowerCase()}`,
      badges: [
        {
          label: `${share}%`,
          icon: 'pie_chart',
          ariaLabel: `${share}% ${shareLabel}`,
          title: `${share}% ${shareLabel}`,
          tone: entry.sharePercent > 0 ? 'accent' : 'muted',
          position: 'top-right'
        }
      ],
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
