import {
  normalizeImageDetails as normalizeSharedImageDetails,
  type ImageDetails as SharedImageDetails,
  type ImageDetailsConfig as SharedImageDetailsConfig
} from '@myscoutee/components';
export interface ImageEventReference {
  id: string;
  title: string;
  organizerId: string;
  organizerName: string;
  location: string;
}
export interface ImageDetails extends SharedImageDetails { event?: ImageEventReference | null; }
export interface ImageDetailsConfig extends SharedImageDetailsConfig {
  eventRequired?: boolean;
  selectEvent?: (current?: ImageEventReference | null) => Promise<ImageEventReference | null>;
}
export type ImageDetailsMap = Record<string, ImageDetails>;

/** Keep metadata attached to canonical URLs through reorder/removal and persistence. */
export function normalizeImageDetails(details: ImageDetailsMap | null | undefined, urls: readonly string[]): ImageDetailsMap {
  const normalized = normalizeSharedImageDetails(details, urls);
  return Object.fromEntries(Object.entries(normalized).map(([url, value]) =>
    [url, { location: value.location, caption: value.caption, ...(value.event ? { event: { ...value.event } } : {}) }]));
}
