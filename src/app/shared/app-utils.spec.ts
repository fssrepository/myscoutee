import { AppUtils } from './app-utils';

describe('AppUtils media image variants', () => {
  it('rewrites only the managed image object name', () => {
    const source = managedImageUrl('large');

    expect(AppUtils.mediaImageVariantUrl(source, 'small')).toBe(managedImageUrl('small'));
    expect(AppUtils.mediaImageVariantUrl(source, 'medium')).toBe(managedImageUrl('medium'));
    expect(AppUtils.mediaImageVariantUrl(source, 'large')).toBe(source);
  });

  it('rewrites managed article images without changing external images', () => {
    const managed = managedImageUrl('medium');
    const external = 'https://cdn.example.test/article.jpg';
    const rendered = AppUtils.mediaImageVariantHtml(
      `<p>Body</p><img src="${managed}" alt="Managed"><img src="${external}" alt="External">`,
      'large'
    );
    const template = document.createElement('template');
    template.innerHTML = rendered;
    const images = Array.from(template.content.querySelectorAll<HTMLImageElement>('img'));

    expect(images.map(image => image.getAttribute('src'))).toEqual([
      managedImageUrl('large'),
      external
    ]);
  });
});

function managedImageUrl(variant: 'small' | 'medium' | 'large'): string {
  return `/api/media/public?key=${encodeURIComponent(`images/owner/article/upload-1/${variant}.webp`)}`;
}
