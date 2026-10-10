import type { ImageDetailsAdapter } from '@myscoutee/components';
import type { ImageDetails, ImageDetailsConfig } from '../../../core/contracts/image-gallery.interface';
import { normalizeImageDetails } from '../../../core/contracts/image-gallery.interface';

/** MyScoutee event association stays with the photo-feed domain. */
export const MYSCOUTEE_IMAGE_DETAILS: ImageDetailsAdapter = {
  normalize: normalizeImageDetails,
  valid: (details: ImageDetails | undefined, config: ImageDetailsConfig) => !config.eventRequired || !!details?.event?.id,
  showLocation: (config: ImageDetailsConfig, readOnly) => !config.eventRequired || readOnly,
  field: (details: ImageDetails, config: ImageDetailsConfig, readOnly) => {
    if (!config.eventRequired && !details.event) return null;
    return {
      label: 'feed.event.label', required: true, guideFieldId: 'image-event',
      items: [{ id: 'event', icon: 'event', label: details.event?.title || 'feed.event.select',
        palette: details.event?.id ? 'blue' : 'danger', surface: 'tinted', layout: 'action', disabled: readOnly }],
      descriptionLabel: 'organizer',
      description: readOnly && details.event ? details.event.organizerName : undefined,
      select: async () => {
        const event = await config.selectEvent?.(details.event);
        return event ? { ...details, event, location: event.location } : null;
      }
    };
  }
};
