import type { UiImageUrls } from '@myscoutee/components';
import { AppUtils } from '../app-utils';

export const MYSCOUTEE_IMAGE_URLS: UiImageUrls = {
  variantUrl: (url, variant) => AppUtils.mediaImageVariantUrl(url, variant),
  cardFallbackUrl: 'assets/logo/cards_no_edges.png',
  resolveSourceUrl: url => {
    const prefix = 'help-seeded-image:';
    if (!url.startsWith(prefix)) return url;
    const parts = url.slice(prefix.length).split('/').map(value => {
      const normalized = value.trim().toLowerCase();
      return /^[a-z0-9-]+$/.test(normalized) ? normalized : '';
    }).filter(Boolean);
    if (parts.length < 3) return url;
    const [language, context, section] = parts;
    return `assets/help-center/explanations/${language}/${context}/${section}.svg`;
  }
};
