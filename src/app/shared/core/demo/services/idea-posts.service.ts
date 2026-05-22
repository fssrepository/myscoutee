import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppMemoryDb } from '../../base/db';
import type { IdeaPost, IdeaPostSaveRequest } from '../../base/models';
import { DemoSeedScheduleBuilder } from '../builders';
import { IDEA_POSTS_TABLE_NAME, type DemoIdeaPostsTable } from '../models/idea-posts.model';
import { RouteDelayService } from '../../base/services/route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoIdeaPostsService {
  private static readonly MAX_IMAGE_URLS = 24;
  private static readonly PERSIST_TIMEOUT_MS = 1500;
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly routeDelay = inject(RouteDelayService);

  async loadPublishedPosts(lang?: string | null): Promise<IdeaPost[]> {
    await this.memoryDb.whenReady();
    const changed = this.ensureSeeded();
    if (changed) {
      await this.persistBestEffort();
    }
    const language = this.requestContentLang(lang);
    const posts = this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === language);
    return posts.length > 0 ? posts : this.sortedPosts(this.table()).filter(post => post.published && !post.trashed && post.lang === 'en');
  }

  async loadAdminPosts(_adminUserId = '', lang = 'en'): Promise<IdeaPost[]> {
    await this.memoryDb.whenReady();
    const changed = this.ensureSeeded();
    if (changed) {
      await this.persistBestEffort();
    }
    await this.routeDelay.waitForRouteDelay('/admin/ideas', undefined, undefined, 900);
    const language = this.normalizeLang(lang);
    return this.sortedPosts(this.table()).filter(post => post.lang === language);
  }

  async savePost(request: IdeaPostSaveRequest): Promise<IdeaPost> {
    await this.memoryDb.whenReady();
    this.ensureSeeded();
    const nowIso = new Date().toISOString();
    const language = this.normalizeLang(request.lang);
    const requestedContentKey = `${request.contentKey ?? ''}`.trim();
    const matchingTranslation = !request.id && requestedContentKey
      ? this.sortedPosts(this.table()).find(post => post.contentKey === requestedContentKey && post.lang === language) ?? null
      : null;
    const existing = request.id ? this.table().byId[request.id] ?? null : matchingTranslation;
    const id = request.id?.trim() || existing?.id || this.newId('idea');
    const contentKey = requestedContentKey || existing?.contentKey || this.contentKeyFromId(id);
    const contentHtml = this.normalizeHtml(request.contentHtml);
    const imageUrls = this.imageUrls(request.imageUrls, request.imageUrl);
    const post: IdeaPost = {
      id,
      contentKey,
      lang: language,
      languageLabel: this.languageLabel(language),
      title: request.title.trim() || 'Untitled idea',
      excerpt: this.excerpt(request.excerpt, contentHtml),
      contentHtml,
      imageUrl: request.imageUrl.trim() || imageUrls[0] || '',
      imageUrls,
      featured: request.featured === true,
      published: request.published !== false,
      trashed: false,
      trashedAtIso: '',
      trashedByUserId: '',
      submittedAtIso: this.submittedAtIso(request.submittedAtIso, existing?.submittedAtIso, nowIso),
      createdAtIso: existing?.createdAtIso || nowIso,
      createdByUserId: existing?.createdByUserId || request.actorUserId.trim() || 'admin',
      updatedAtIso: nowIso,
      updatedByUserId: request.actorUserId.trim() || 'admin'
    };
    this.memoryDb.write(state => {
      const table = state[IDEA_POSTS_TABLE_NAME];
      return {
        ...state,
        [IDEA_POSTS_TABLE_NAME]: {
          ...table,
          seeded: true,
          byId: {
            ...table.byId,
            [id]: post
          },
          ids: [...new Set([...table.ids.filter(currentId => currentId !== id), id])]
        }
      };
    });
    await Promise.all([
      this.persistBestEffort(),
      this.routeDelay.waitForRouteDelay('/admin/ideas', undefined, undefined, 900)
    ]);
    return this.clonePost(post);
  }

  async deletePost(postId: string, actorUserId = ''): Promise<IdeaPost[]> {
    await this.memoryDb.whenReady();
    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      return this.sortedPosts(this.table());
    }
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    this.memoryDb.write(state => {
      const table = state[IDEA_POSTS_TABLE_NAME];
      const post = table.byId[normalizedPostId];
      if (!post) {
        return state;
      }
      return {
        ...state,
        [IDEA_POSTS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [normalizedPostId]: {
              ...this.normalizePost(post),
              featured: false,
              published: false,
              trashed: true,
              trashedAtIso: nowIso,
              trashedByUserId: actor,
              updatedAtIso: nowIso,
              updatedByUserId: actor
            }
          }
        }
      };
    });
    await Promise.all([
      this.persistBestEffort(),
      this.routeDelay.waitForRouteDelay('/admin/ideas', undefined, undefined, 900)
    ]);
    return this.sortedPosts(this.table());
  }

  async restorePost(postId: string, actorUserId = ''): Promise<IdeaPost> {
    await this.memoryDb.whenReady();
    const normalizedPostId = postId.trim();
    const nowIso = new Date().toISOString();
    const actor = actorUserId.trim() || 'admin';
    let restored: IdeaPost | null = null;
    this.memoryDb.write(state => {
      const table = state[IDEA_POSTS_TABLE_NAME];
      const post = table.byId[normalizedPostId];
      if (!normalizedPostId || !post) {
        return state;
      }
      restored = {
        ...this.normalizePost(post),
        featured: false,
        published: false,
        trashed: false,
        trashedAtIso: '',
        trashedByUserId: '',
        updatedAtIso: nowIso,
        updatedByUserId: actor
      };
      return {
        ...state,
        [IDEA_POSTS_TABLE_NAME]: {
          ...table,
          byId: {
            ...table.byId,
            [normalizedPostId]: restored
          }
        }
      };
    });
    await Promise.all([
      this.persistBestEffort(),
      this.routeDelay.waitForRouteDelay('/admin/ideas', undefined, undefined, 900)
    ]);
    if (!restored) {
      throw new Error('Article could not be restored.');
    }
    return this.clonePost(restored);
  }

  private ensureSeeded(): boolean {
    const table = this.table();
    const defaultPosts = this.defaultPosts();
    const missingPosts = defaultPosts.filter(post => !table.byId[post.id]);
    if (missingPosts.length === 0) {
      return false;
    }
    this.memoryDb.write(state => ({
      ...state,
      [IDEA_POSTS_TABLE_NAME]: {
        seeded: true,
        byId: {
          ...state[IDEA_POSTS_TABLE_NAME].byId,
          ...Object.fromEntries(missingPosts.map(post => [post.id, post]))
        },
        ids: [...new Set([...state[IDEA_POSTS_TABLE_NAME].ids, ...missingPosts.map(post => post.id)])]
      }
    }));
    return true;
  }

  private table(): DemoIdeaPostsTable {
    return this.memoryDb.read()[IDEA_POSTS_TABLE_NAME];
  }

  private async persistBestEffort(): Promise<void> {
    try {
      await Promise.race([
        this.memoryDb.flushToIndexedDb(),
        new Promise<void>(resolve => globalThis.setTimeout(resolve, DemoIdeaPostsService.PERSIST_TIMEOUT_MS))
      ]);
    } catch {
      // Demo content still exists in memory even when browser storage is temporarily unavailable.
    }
  }

  private sortedPosts(table: DemoIdeaPostsTable): IdeaPost[] {
    return table.ids
      .map(id => table.byId[id])
      .filter((post): post is IdeaPost => Boolean(post))
      .map(post => this.clonePost(this.normalizePost(post)))
      .sort((left, right) => this.sortValue(right) - this.sortValue(left));
  }

  private normalizePost(post: IdeaPost): IdeaPost {
    const contentHtml = this.normalizeHtml(post.contentHtml);
    const imageUrls = this.imageUrls(post.imageUrls, post.imageUrl);
    return {
      id: `${post.id ?? ''}`.trim(),
      contentKey: this.contentKeyFromId(`${post.contentKey ?? post.id ?? ''}`),
      lang: this.normalizeLang(post.lang),
      languageLabel: this.languageLabel(post.lang),
      title: `${post.title ?? ''}`.trim() || 'Untitled idea',
      excerpt: this.excerpt(post.excerpt, contentHtml),
      contentHtml,
      imageUrl: `${post.imageUrl ?? ''}`.trim() || imageUrls[0] || '',
      imageUrls,
      featured: post.featured === true,
      published: post.published !== false,
      trashed: post.trashed === true,
      trashedAtIso: `${post.trashedAtIso ?? ''}`.trim(),
      trashedByUserId: `${post.trashedByUserId ?? ''}`.trim(),
      submittedAtIso: `${post.submittedAtIso ?? ''}`.trim() || `${post.updatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      createdAtIso: `${post.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${post.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${post.updatedAtIso ?? post.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${post.updatedByUserId ?? post.createdByUserId ?? ''}`.trim()
    };
  }

  private clonePost(post: IdeaPost): IdeaPost {
    return {
      ...post,
      imageUrls: [...post.imageUrls]
    };
  }

  private defaultPosts(): IdeaPost[] {
    const nowIso = new Date().toISOString();
    const enPosts = [
      this.defaultPost({
        id: 'idea-why-priority-matching',
        lang: 'en',
        title: 'Why priority matching feels calmer than swiping',
        excerpt: 'MyScoutee starts with intent, context, and real plans instead of an endless yes/no loop.',
        contentHtml: `
          <p><strong>Most dating apps optimize for quick reactions. MyScoutee is built for decisions that can become real plans.</strong></p>
          <p>Members can express priority instead of only swiping yes or no, so interest has more texture and the next step can be clearer.</p>
          <p>That makes the product feel less like a slot machine and more like a social planning tool.</p>
          <ul>
            <li>Priority scores communicate stronger intent.</li>
            <li>Context helps people understand why a match makes sense.</li>
            <li>Events give the connection a natural next step.</li>
          </ul>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-29T10:00:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-social-first-dating',
        lang: 'en',
        title: 'From lonely browsing to social-first meeting',
        excerpt: 'Groups, hosts, and event context make introductions feel more natural and lower-pressure.',
        contentHtml: `
          <p>MyScoutee is useful when someone wants to meet people without making every conversation feel like an interview.</p>
          <p>A hosted activity creates shared context before the first message, which makes the first interaction easier to start and easier to trust.</p>
          <figure>
            <img src="@image_url" alt="People joining a social event">
            <figcaption>Shared plans give people something real to react to.</figcaption>
          </figure>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case',
        lang: 'en',
        title: 'Use case: host a small event and let the right people join',
        excerpt: 'Hosts can describe the plan, capacity, resources, and tone before inviting or approving members.',
        contentHtml: `
          <p>A host can create a small plan, split it into optional parts, and keep logistics visible from the start.</p>
          <p>Instead of managing scattered messages, the event can carry details like time, capacity, resources, members, and chat context.</p>
          <ul>
            <li>Great for brunches, walks, games, sport sessions, or low-pressure meetups.</li>
            <li>Useful when the host wants a specific vibe and group size.</li>
            <li>Clearer than posting a vague invitation into a generic feed.</li>
          </ul>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-20T09:15:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-trust-context',
        lang: 'en',
        title: 'Trust grows faster when context stays attached',
        excerpt: 'Profiles, event history, feedback, and scoped chats help people understand who they are meeting.',
        contentHtml: `
          <p>Trust is easier when the product keeps context visible. A person is not only a photo; they are also how they join, host, communicate, and follow through.</p>
          <p>MyScoutee can connect profile signals, event participation, feedback, and scoped chats so users do not have to guess from one empty message thread.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-16T16:45:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-register-value',
        lang: 'en',
        title: 'What viewers unlock when they register',
        excerpt: 'Registration turns a static landing page into matching, event discovery, hosting, chat, and feedback.',
        contentHtml: `
          <p>Visitors can understand the idea from the landing page, but the value starts once they register and build a profile.</p>
          <p>From there, MyScoutee can show relevant people, support event invitations, coordinate in chats, and learn from feedback after real social activity.</p>
          <ul>
            <li>Discover people through priorities and activities.</li>
            <li>Join or host plans with clearer expectations.</li>
            <li>Use feedback to make the next match or event better.</li>
          </ul>
        `,
        featured: false,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-11T13:20:00.000Z'),
        nowIso
      })
    ];
    const huPosts = [
      this.defaultPost({
        id: 'idea-why-priority-matching-hu',
        lang: 'hu',
        title: 'Miért nyugodtabb a preferenciaalapú párosítás, mint a swipe-olás',
        excerpt: 'A MyScoutee szándékkal, kontextussal és valódi tervekkel indul a végtelen igen/nem kör helyett.',
        contentHtml: '<p><strong>A legtöbb társkereső gyors reakciókra optimalizál. A MyScoutee olyan döntésekre épül, amelyekből valódi tervek lehetnek.</strong></p><p>A tagok nem csak igent vagy nemet jeleznek, hanem prioritást is, így az érdeklődés árnyaltabb és a következő lépés tisztább.</p><ul><li>A prioritási pontszám erősebb szándékot mutat.</li><li>A kontextus segít megérteni, miért van értelme egy találatnak.</li><li>Az események természetes következő lépést adnak.</li></ul>',
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-29T10:00:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-social-first-dating-hu',
        lang: 'hu',
        title: 'Magányos böngészésből közösségi találkozás',
        excerpt: 'A csoportok, szervezők és eseménykontextus természetesebbé és kevésbé nyomasztóvá teszik a bemutatkozást.',
        contentHtml: '<p>A MyScoutee akkor hasznos, amikor valaki úgy szeretne emberekkel találkozni, hogy ne minden beszélgetés interjúnak érződjön.</p><p>Egy szervezett program már az első üzenet előtt közös kontextust ad.</p>',
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case-hu',
        lang: 'hu',
        title: 'Példa: szervezz kis eseményt, és engedd csatlakozni a megfelelő embereket',
        excerpt: 'A szervezők még meghívás vagy jóváhagyás előtt leírhatják a tervet, létszámot, erőforrásokat és hangulatot.',
        contentHtml: '<p>A szervező létrehozhat egy kisebb tervet, opcionális részekre bonthatja, és a logisztikát elejétől láthatóvá teheti.</p><ul><li>Jó brunchhoz, sétához, játékhoz, sporthoz vagy laza találkozóhoz.</li><li>Hasznos, ha a szervező konkrét hangulatot és csoportméretet szeretne.</li></ul>',
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-20T09:15:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-trust-context-hu',
        lang: 'hu',
        title: 'A bizalom gyorsabban nő, ha a kontextus megmarad',
        excerpt: 'Profilok, eseménytörténet, visszajelzés és célzott csevegések segítik megérteni, kivel találkozol.',
        contentHtml: '<p>A bizalom könnyebb, ha a termék láthatóan tartja a kontextust. Egy ember nem csak fotó: az is számít, hogyan csatlakozik, szervez és kommunikál.</p>',
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-16T16:45:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-register-value-hu',
        lang: 'hu',
        title: 'Mit nyit meg a regisztráció',
        excerpt: 'A regisztrációból lesz párosítás, eseményfelfedezés, szervezés, chat és visszajelzés.',
        contentHtml: '<p>A látogatók a landing oldalon megértik az ötletet, de az érték akkor indul, amikor regisztrálnak és profilt építenek.</p><ul><li>Emberek felfedezése prioritások és aktivitások alapján.</li><li>Tervekhez csatlakozás vagy szervezés tisztább elvárásokkal.</li></ul>',
        featured: false,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-11T13:20:00.000Z'),
        nowIso
      })
    ];
    return [...enPosts, ...huPosts];
  }

  private rebaseSeedDateTime(value: string): string {
    return DemoSeedScheduleBuilder.rebaseDateTime(value) ?? value;
  }

  private defaultPost(options: {
    id: string;
    lang: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    featured: boolean;
    submittedAtIso: string;
    nowIso: string;
  }): IdeaPost {
    const imageUrl = this.seedImageUrl(options.id);
    return {
      id: options.id,
      contentKey: this.contentKeyFromId(options.id),
      lang: this.normalizeLang(options.lang),
      languageLabel: this.languageLabel(options.lang),
      title: options.title,
      excerpt: options.excerpt,
      contentHtml: this.normalizeHtml(options.contentHtml.replaceAll('@image_url', imageUrl)),
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

  private seedImageUrl(postId: string): string {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(this.seedImageSvg(postId))}`;
  }

  private seedImageSvg(postId: string): string {
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

  private hashText(value: string): number {
    return value.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  private normalizeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private excerpt(explicitExcerpt: string | null | undefined, contentHtml: string): string {
    const normalized = `${explicitExcerpt ?? ''}`.trim();
    if (normalized) {
      return this.truncate(normalized);
    }
    const text = this.htmlToText(contentHtml);
    return this.truncate(text);
  }

  private htmlToText(value: string): string {
    if (typeof document === 'undefined') {
      return `${value ?? ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const template = document.createElement('template');
    template.innerHTML = value;
    return `${template.content.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private truncate(value: string): string {
    const normalized = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
    return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179).trim()}...`;
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private requestContentLang(lang: string | null | undefined): string {
    const explicit = this.supportedContentLang(lang);
    if (explicit) {
      return explicit;
    }
    return this.supportedContentLang(this.browserLanguage()) || 'en';
  }

  private browserLanguage(): string {
    const languages = this.browserLanguages()
      .map(value => this.normalizeRequestLanguage(value))
      .filter(Boolean);
    return languages.find(lang => lang !== 'en') ?? languages[0] ?? 'en';
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  }

  private supportedContentLang(lang: string | null | undefined): string | null {
    const requested = this.normalizeRequestLanguage(lang);
    return APP_STATIC_DATA.contentLanguages.some(language => this.normalizeLang(language.lang) === requested)
      ? requested
      : null;
  }

  private normalizeRequestLanguage(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
    return normalized;
  }

  private languageLabel(lang: string | null | undefined): string {
    return this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English';
  }

  private contentKeyFromId(id: string | null | undefined): string {
    const normalized = `${id ?? ''}`.trim();
    return normalized.endsWith('-hu') ? normalized.slice(0, -3) : normalized;
  }

  private imageUrls(imageUrls: readonly string[] | null | undefined, primaryImageUrl: string | null | undefined): string[] {
    const urls = new Set<string>();
    const primary = `${primaryImageUrl ?? ''}`.trim();
    if (primary) {
      urls.add(primary);
    }
    for (const imageUrl of imageUrls ?? []) {
      const normalized = `${imageUrl ?? ''}`.trim();
      if (normalized) {
        urls.add(normalized);
      }
      if (urls.size >= DemoIdeaPostsService.MAX_IMAGE_URLS) {
        break;
      }
    }
    return [...urls];
  }

  private submittedAtIso(requested: string, existing: string | undefined, fallback: string): string {
    const normalized = requested.trim();
    if (normalized) {
      const parsed = Date.parse(normalized);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalized;
    }
    return existing?.trim() || fallback;
  }

  private sortValue(post: Pick<IdeaPost, 'submittedAtIso' | 'updatedAtIso' | 'createdAtIso'>): number {
    const parsed = Date.parse(post.submittedAtIso || post.updatedAtIso || post.createdAtIso || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
