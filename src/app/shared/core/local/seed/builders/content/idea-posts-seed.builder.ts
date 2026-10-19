import SUPPORTED_CONTENT_LANGUAGES from '../../../../common/content-languages.json';
import { sanitizeHtml } from '../../../../base/html-sanitizer';
import { UiDateUtils } from '@fssrepository/myscoutee-components';
import datingArticles from '../../data/dating-articles.json';
import workArticles from '../../data/work-articles.json';
import communityArticles from '../../data/community-articles.json';
import { APP_STATIC_DATA } from '../../../../common/app-static-data';
import { environment } from '../../../../../../../environments/environment';
import type { IdeaPostDto } from '../../../../contracts/content/content.interface';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../../seed-constants';

export class SeedIdeaPostsBuilder {
  static buildDefaultPosts(): IdeaPostDto[] {
    const nowIso = new Date().toISOString();
    return [
      ...datingArticles.map(post => this.defaultPost({ ...post, submittedAtIso: this.rebaseSeedDateTime(post.submittedAtIso), nowIso })),
      ...[...workArticles, ...communityArticles].map(post => this.defaultPost({ ...post, nowIso }))
    ];
  }

  private static defaultPost(options: {
    id: string;
    workspaceGroupId?: string;
    imageUrl?: string;
    lang: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    featured: boolean;
    submittedAtIso: string;
    nowIso: string;
  }): IdeaPostDto {
    const imageUrl = options.imageUrl ?? this.seedImageUrl(options.id);
    const contentHtml = this.normalizeHtml(options.contentHtml.replaceAll('@image_url', imageUrl));
    return {
      id: options.id,
      workspaceGroupId: options.workspaceGroupId ?? null,
      contentKey: this.contentKeyFromId(options.id),
      lang: this.normalizeLang(options.lang),
      languageLabel: this.languageLabel(options.lang),
      title: options.title,
      excerpt: options.excerpt,
      contentHtml: this.withPrimaryImage(contentHtml, imageUrl, options.title),
      imageUrl,
      imageUrls: [imageUrl],
      featured: options.featured,
      published: true,
      trashed: false,
      trashedAtIso: '',
      trashedByUserId: '',
      submittedAtIso: options.submittedAtIso,
      createdAtIso: options.nowIso,
      createdByUserId: 'system',
      updatedAtIso: options.nowIso,
      updatedByUserId: 'system'
    };
  }

  private static withPrimaryImage(contentHtml: string, imageUrl: string, title: string): string {
    if (contentHtml.includes(imageUrl)) {
      return contentHtml;
    }
    const alt = title
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    return `${contentHtml}\n<figure><img src="${imageUrl}" alt="${alt}"></figure>`;
  }

  private static rebaseSeedDateTime(value: string): string {
    return UiDateUtils.rebaseDateTime(value, SEED_SCHEDULE_REFERENCE_DATE, environment.bootstrapOffsetInDays) ?? value;
  }

  private static seedImageUrl(postId: string): string {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(this.seedImageSvg(postId))}`;
  }

  private static seedImageSvg(postId: string): string {
    const palettes = [
      ['#eff6ff', '#6e8fc1', '#f1b66d', '#173456'],
      ['#f4fbf5', '#6aa98a', '#d9a652', '#1f3d34'],
      ['#fff7f0', '#c98256', '#7aa4c7', '#263b56'],
      ['#f7f2ff', '#8d78b8', '#e7b36d', '#21314c'],
      ['#f3f7f8', '#658aa3', '#d3a871', '#1d3442']
    ];
    const [paper, cool, warm, ink] = palettes[Math.abs(this.hashText(postId)) % palettes.length];
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" role="img">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${paper}"/>
            <stop offset="0.56" stop-color="#ffffff"/>
            <stop offset="1" stop-color="${cool}"/>
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="24"/>
          </filter>
        </defs>
        <rect width="1200" height="700" fill="url(#sky)"/>
        <g filter="url(#soft)" opacity="0.78">
          <circle cx="240" cy="170" r="132" fill="${warm}"/>
          <circle cx="930" cy="190" r="150" fill="${cool}"/>
          <rect x="615" y="310" width="380" height="210" rx="34" fill="${warm}" opacity="0.45"/>
        </g>
        <rect x="0" y="475" width="1200" height="225" fill="#ffffff" opacity="0.62"/>
        <rect x="105" y="150" width="390" height="285" rx="28" fill="#ffffff" opacity="0.74"/>
        <rect x="145" y="192" width="310" height="22" rx="11" fill="${ink}" opacity="0.22"/>
        <rect x="145" y="238" width="260" height="18" rx="9" fill="${ink}" opacity="0.18"/>
        <rect x="145" y="284" width="185" height="18" rx="9" fill="${ink}" opacity="0.16"/>
        <circle cx="792" cy="285" r="54" fill="${cool}" opacity="0.7"/>
        <circle cx="910" cy="312" r="48" fill="${warm}" opacity="0.52"/>
        <circle cx="690" cy="322" r="42" fill="${ink}" opacity="0.48"/>
        <path d="M640 520c46-85 230-94 320 0" fill="${ink}" opacity="0.22"/>
        <path d="M112 550c145-42 295-44 454-2 162 43 332 42 520-6" fill="none" stroke="${ink}" stroke-width="18" opacity="0.18"/>
        <rect x="0" y="0" width="1200" height="700" fill="#0a1726" opacity="0.02"/>
      </svg>
    `.trim();
  }

  private static hashText(value: string): number {
    return value.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  private static normalizeHtml(value: string): string {
    return sanitizeHtml(value);
  }

  private static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }

  private static languageLabel(lang: string | null | undefined): string {
    const normalized = this.normalizeLang(lang);
    return APP_STATIC_DATA.contentLanguages.find(language => this.normalizeLang(language.lang) === normalized)?.label
      ?? (normalized === 'hu' ? 'Magyar' : 'English');
  }

  private static contentKeyFromId(id: string | null | undefined): string {
    const normalized = `${id ?? ''}`.trim();
    return normalized.replace(/-(?:hu|de|es)$/, '');
  }
}
