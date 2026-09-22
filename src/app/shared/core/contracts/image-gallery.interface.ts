export interface ImageDetails { location: string; caption: string; }
export type ImageDetailsMap = Record<string, ImageDetails>;
export const IMAGE_CAPTION_MAX_LENGTH = 40;

/** Keep metadata attached to canonical URLs through reorder/removal and persistence. */
export function normalizeImageDetails(details: ImageDetailsMap | null | undefined, urls: readonly string[]): ImageDetailsMap {
  return Object.fromEntries(urls.filter(url => details?.[url]).map(url => {
    const value = details![url];
    const caption = `${value.caption ?? ''}`.replace(/\s+/g, ' ').trim();
    const location = `${value.location ?? ''}`.trim();
    if (caption.length > IMAGE_CAPTION_MAX_LENGTH || location.length > 240) throw new Error('Image details exceed the allowed length.');
    return [url, { location, caption }];
  }));
}
