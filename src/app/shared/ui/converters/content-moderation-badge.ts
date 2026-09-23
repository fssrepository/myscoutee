import type { InfoCardOverlayAction } from '../components/core/smart-list/card/card.types';

/** Content review is independent of the owner's account lifecycle. */
export function contentModerationBadge(status?: string | null): InfoCardOverlayAction | null {
  const label = `moderation.status.${status}`;
  switch (status) {
    case 'under-review':
      return { variant: 'badge', tone: 'teal', icon: 'fact_check', label, ariaLabel: label, interactive: false };
    case 'rejected':
      return { variant: 'badge', tone: 'purple', icon: 'cancel', label, ariaLabel: label, interactive: false };
    case 'blocked':
      return { variant: 'badge', tone: 'danger', icon: 'block', label, ariaLabel: label, interactive: false };
    default:
      return null;
  }
}
