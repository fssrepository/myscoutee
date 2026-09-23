import type { ModerationStatus } from '../../core/contracts/content-moderation.interface';
import type { AppMenuPalette } from '../components/core/menu';

export const MODERATION_STATUS_STYLE: Record<ModerationStatus, { icon: string; palette: AppMenuPalette }> = {
  'under-review': { icon: 'fact_check', palette: 'teal' },
  accepted: { icon: 'check_circle', palette: 'green' },
  rejected: { icon: 'cancel', palette: 'purple' },
  blocked: { icon: 'block', palette: 'danger' }
};
