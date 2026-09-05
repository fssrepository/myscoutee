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

  it('removes image and link elements for every variant of a managed image group', () => {
    const html = `<p>Body</p><figure><img src="${managedImageUrl('small')}" alt="Managed"></figure>`
      + `<a href="${managedImageUrl('medium')}">Managed link</a>`
      + '<img alt="Already broken">'
      + '<img src="https://cdn.example.test/keep.jpg" alt="Keep">';

    const rendered = AppUtils.removeManagedImageReferencesHtml(html, [managedImageUrl('large')]);
    const template = document.createElement('template');
    template.innerHTML = rendered;

    expect(template.content.querySelectorAll('figure, a')).toHaveLength(0);
    expect(Array.from(template.content.querySelectorAll('img')).map(image => image.getAttribute('src')))
      .toEqual(['https://cdn.example.test/keep.jpg']);
  });

  it('detects paste positions inside an HTML tag without treating body text as markup', () => {
    const html = '<p>Body</p>\n<img src="" alt="Managed">';
    const attributeOffset = html.indexOf('src="') + 'src="'.length;

    expect(AppUtils.isHtmlTagPosition(html, attributeOffset)).toBe(true);
    expect(AppUtils.isHtmlTagPosition(html, html.indexOf('Body') + 2)).toBe(false);
    expect(AppUtils.isHtmlTagPosition(html, html.length)).toBe(false);
  });

  it('recognizes copied plain-text HTML fragments from rendered code blocks', () => {
    expect(AppUtils.looksLikeHtmlFragment('<p>Copied body</p>')).toBe(true);
    expect(AppUtils.looksLikeHtmlFragment('<img src="/media/public?key=image">')).toBe(true);
    expect(AppUtils.looksLikeHtmlFragment('Copied body')).toBe(false);
  });
});

describe('AppUtils date-time range text', () => {
  it('formats an embedded raw ISO interval', () => {
    const start = '2026-09-06T06:23:33.087Z';
    const end = '2026-09-06T08:23:33.087Z';

    expect(AppUtils.normalizeDateTimeRangeText(`${start} – ${end}`))
      .toBe(AppUtils.dateTimeRangeLabel(start, end));
  });

  it('preserves an already formatted label', () => {
    expect(AppUtils.normalizeDateTimeRangeText('Sep 6, 8:23 AM - 10:23 AM'))
      .toBe('Sep 6, 8:23 AM - 10:23 AM');
  });
});

function managedImageUrl(variant: 'small' | 'medium' | 'large'): string {
  return `/api/media/public?key=${encodeURIComponent(`images/owner/article/upload-1/${variant}.webp`)}`;
}
