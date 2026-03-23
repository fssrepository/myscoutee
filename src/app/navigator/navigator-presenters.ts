import { AppUtils } from '../shared/app-utils';

export function resolveHostTierIcon(hostTier: string): string {
  const normalized = AppUtils.normalizeText(hostTier);
  if (normalized.includes('platinum')) {
    return 'diamond';
  }
  if (normalized.includes('gold')) {
    return 'emoji_events';
  }
  if (normalized.includes('silver')) {
    return 'workspace_premium';
  }
  if (normalized.includes('bronze')) {
    return 'military_tech';
  }
  return 'workspace_premium';
}

export function resolveHostTierColorClass(hostTier: string): string {
  const normalized = AppUtils.normalizeText(hostTier);
  if (normalized.includes('platinum')) {
    return 'icon-tier-platinum';
  }
  if (normalized.includes('gold')) {
    return 'icon-tier-gold';
  }
  if (normalized.includes('silver')) {
    return 'icon-tier-silver';
  }
  if (normalized.includes('bronze')) {
    return 'icon-tier-bronze';
  }
  return 'icon-tier-default';
}

export function resolveHostTierToneClass(hostTier: string): string {
  const normalized = AppUtils.normalizeText(hostTier);
  if (normalized.includes('platinum')) {
    return 'impression-shortcut-tone-platinum';
  }
  if (normalized.includes('gold')) {
    return 'impression-shortcut-tone-gold';
  }
  if (normalized.includes('silver')) {
    return 'impression-shortcut-tone-silver';
  }
  if (normalized.includes('bronze')) {
    return 'impression-shortcut-tone-bronze';
  }
  return 'impression-shortcut-tone-platinum';
}

export function resolveTraitIcon(traitLabel: string): string {
  const normalized = AppUtils.normalizeText(traitLabel);
  if (normalized.includes('kreat') || normalized.includes('creative')) {
    return 'palette';
  }
  if (normalized.includes('empat')) {
    return 'favorite';
  }
  if (normalized.includes('megbizh') || normalized.includes('reliable')) {
    return 'verified';
  }
  if (normalized.includes('advent')) {
    return 'hiking';
  }
  if (normalized.includes('think')) {
    return 'psychology';
  }
  if (normalized.includes('social')) {
    return 'groups';
  }
  if (normalized.includes('playful')) {
    return 'sports_esports';
  }
  if (normalized.includes('ambitious') || normalized.includes('goal')) {
    return 'trending_up';
  }
  return 'auto_awesome';
}

export function resolveTraitColorClass(traitLabel: string): string {
  const normalized = AppUtils.normalizeText(traitLabel);
  if (normalized.includes('kreat') || normalized.includes('creative')) {
    return 'icon-trait-creative';
  }
  if (normalized.includes('empat')) {
    return 'icon-trait-empath';
  }
  if (normalized.includes('megbizh') || normalized.includes('reliable')) {
    return 'icon-trait-reliable';
  }
  if (normalized.includes('advent')) {
    return 'icon-trait-adventurer';
  }
  if (normalized.includes('think')) {
    return 'icon-trait-thinker';
  }
  if (normalized.includes('social')) {
    return 'icon-trait-social';
  }
  if (normalized.includes('playful')) {
    return 'icon-trait-playful';
  }
  if (normalized.includes('ambitious') || normalized.includes('goal')) {
    return 'icon-trait-ambitious';
  }
  return 'icon-trait-default';
}

export function resolveTraitToneClass(traitLabel: string): string {
  const normalized = AppUtils.normalizeText(traitLabel);
  if (normalized.includes('kreat') || normalized.includes('creative')) {
    return 'impression-shortcut-tone-creative';
  }
  if (normalized.includes('empat')) {
    return 'impression-shortcut-tone-empath';
  }
  if (normalized.includes('megbizh') || normalized.includes('reliable')) {
    return 'impression-shortcut-tone-reliable';
  }
  if (normalized.includes('advent')) {
    return 'impression-shortcut-tone-adventurer';
  }
  if (normalized.includes('think')) {
    return 'impression-shortcut-tone-thinker';
  }
  if (normalized.includes('social')) {
    return 'impression-shortcut-tone-social';
  }
  if (normalized.includes('playful')) {
    return 'impression-shortcut-tone-playful';
  }
  if (normalized.includes('ambitious') || normalized.includes('goal')) {
    return 'impression-shortcut-tone-ambitious';
  }
  return 'impression-shortcut-tone-thinker';
}

export function resolveMemberImpressionTitle(traitLabel: string): string {
  const normalized = AppUtils.normalizeText(traitLabel);
  if (normalized.includes('empat') || normalized.includes('empath')) {
    return 'Empathetic Attendee';
  }
  if (normalized.includes('advent')) {
    return 'Adventurous Attendee';
  }
  if (normalized.includes('kreat') || normalized.includes('creative')) {
    return 'Creative Attendee';
  }
  if (normalized.includes('think')) {
    return 'Thoughtful Attendee';
  }
  if (normalized.includes('social')) {
    return 'Social Attendee';
  }
  if (normalized.includes('playful')) {
    return 'Playful Attendee';
  }
  if (normalized.includes('ambitious') || normalized.includes('goal')) {
    return 'Ambitious Attendee';
  }
  if (normalized.includes('megbizh') || normalized.includes('reliable')) {
    return 'Reliable Attendee';
  }
  return traitLabel ? `${traitLabel} Attendee` : 'Attendee';
}
