import { APP_STATIC_DATA } from '../../../../app-static-data';
import { AppUtils } from '../../../../app-utils';
import { environment } from '../../../../../../environments/environment';
import type { IdeaPostDto } from '../../../contracts/content.interface';
import { SEED_SCHEDULE_REFERENCE_DATE } from '../seed-constants';

export class SeedIdeaPostsBuilder {
  static buildDefaultPosts(): IdeaPostDto[] {
    const nowIso = new Date().toISOString();
    const enPosts = [
      this.defaultPost({
        id: 'idea-why-priority-matching',
        lang: 'en',
        title: 'How the 1–10 rating helps',
        excerpt: 'A 1–10 rating signals interest and, together with other context, can support suggestions, event invitations, and grouping.',
        contentHtml: `
          <p>When you rate someone from 1 to 10, you signal how interested you are in meeting them. It is an early preference, not a promise or an automatic match. Mutual ratings can carry more weight, while profile details, distance, and recent activity can provide additional context.</p>
          <p>These signals can help order profile suggestions. For published events, they can also support invitations to open places or the grouping of accepted participants when those options are enabled. The rating alone does not create an event or a group chat.</p>
          <p>Feedback after taking part in an event is a separate step. It records the real event experience and can contribute to the impressions shown about a host or participant.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-29T10:00:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-social-first-dating',
        lang: 'en',
        title: 'Meet through a shared activity',
        excerpt: 'An event or group conversation gives the first message a clear, shared topic.',
        contentHtml: `
          <p>Starting a private conversation with a stranger can feel awkward. An event gives the introduction a real topic, such as a walk, game night, sport session, or another small local activity.</p>
          <p>People can ask about the plan, time, and place instead of starting with an empty chat. When the event settings allow it, they can also see who is taking part before deciding whether to join.</p>
          <figure>
            <img src="@image_url" alt="People talking at a small shared activity">
            <figcaption>A shared plan makes it easier to start a conversation.</figcaption>
          </figure>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case',
        lang: 'en',
        title: 'Plan a small event in one place',
        excerpt: 'Set the event details, capacity, visibility, and approval rules before people join.',
        contentHtml: `
          <p>Create an event with a description, date, place, and participant capacity. You can add topics or optional program parts so people know what is planned before they join.</p>
          <ul>
            <li>Choose public, friends-only, or invitation-only visibility.</li>
            <li>Decide whether joining requests need approval.</li>
            <li>Invite people directly or, when enabled, use automatic invitations for open places.</li>
          </ul>
          <p>The event keeps the main details in one place, so participants can check the same information before requesting a spot or accepting an invitation.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-20T09:15:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-trust-context',
        lang: 'en',
        title: 'More context before you meet',
        excerpt: 'Profiles, event roles, related chats, and impressions help people understand who they are meeting.',
        contentHtml: `
          <p>A profile can show details that a person chooses to share. An event adds the plan and each member's role or participation, while its event or group chat keeps the conversation connected to that plan.</p>
          <p>After taking part, hosts and participants can give separate event feedback. It can contribute to the impressions shown about a host or member, providing useful context without guaranteeing how a future meeting will go.</p>
          <p>This information reduces guesswork, but everyone still decides for themselves whom they want to meet.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-16T16:45:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-register-value',
        lang: 'en',
        title: 'What you can do with an account',
        excerpt: 'Create a profile, discover people and events, host plans, use chats, and give feedback after participating.',
        contentHtml: `
          <p>After registering, you can create a profile and choose its visibility. A public profile is needed to appear in profile suggestions and use the people-rating features.</p>
          <ul>
            <li>Discover and rate people, and explore available events.</li>
            <li>Request a place, accept invitations, or host and manage an event.</li>
            <li>Use event, group, and support chats, then give feedback after participating.</li>
          </ul>
          <p>Your account keeps your profile and activity available between visits, so you can return to your plans and conversations.</p>
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
        title: 'Hogyan segít az 1–10-es értékelés?',
        excerpt: 'Az 1–10-es értékelés érdeklődést jelez, és más adatokkal együtt segítheti az ajánlást, az eseménymeghívást és a csoportosítást.',
        contentHtml: `
          <p>Amikor 1-től 10-ig értékelsz valakit, azt jelzed, mennyire szívesen találkoznál vele. Ez egy előzetes érdeklődési jel, nem ígéret és nem automatikus párosítás. A kölcsönös értékelés nagyobb súlyt kaphat, míg a profil adatai, a távolság és a legutóbbi aktivitás további hátteret adhatnak.</p>
          <p>Ezek a jelek segíthetik a profilajánlások sorrendjét. Közzétett eseményeknél, ha a megfelelő lehetőség be van kapcsolva, az üres helyekre szóló meghívást vagy az elfogadott résztvevők csoportosítását is támogathatják. Az értékelés önmagában nem hoz létre eseményt vagy csoportos csevegést.</p>
          <p>A tényleges eseményen való részvétel után külön visszajelzés adható. Ez a valós élményt rögzíti, és hozzájárulhat a szervezőről vagy résztvevőről megjelenő benyomásokhoz.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-29T10:00:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-social-first-dating-hu',
        lang: 'hu',
        title: 'Találkozzatok közös programon keresztül',
        excerpt: 'Egy esemény vagy csoportos csevegés világos, közös témát ad az első üzenethez.',
        contentHtml: `
          <p>Egy idegennel nehéz lehet személyes beszélgetést kezdeni. Egy esemény konkrét témát ad a bemutatkozáshoz: lehet séta, társasjáték, sport vagy más kisebb helyi program.</p>
          <p>A résztvevők az üres csevegőablak helyett a tervről, az időpontról és a helyszínről kérdezhetnek. Ha az esemény beállításai engedik, azt is láthatják, kik vesznek részt, mielőtt csatlakoznak.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case-hu',
        lang: 'hu',
        title: 'Szervezz kis eseményt egy helyen',
        excerpt: 'Állítsd be az esemény részleteit, létszámát, láthatóságát és jóváhagyási szabályait a csatlakozás előtt.',
        contentHtml: `
          <p>Hozz létre eseményt leírással, időponttal, helyszínnel és létszámkorláttal. Témákat vagy választható programelemeket is hozzáadhatsz, hogy mindenki előre lássa a tervet.</p>
          <ul>
            <li>Válassz nyilvános, csak barátoknak szóló vagy meghívásos láthatóságot.</li>
            <li>Döntsd el, hogy a jelentkezéseket jóvá kell-e hagyni.</li>
            <li>Hívj meg embereket közvetlenül, vagy bekapcsolt funkció esetén használj automatikus meghívást az üres helyekre.</li>
          </ul>
          <p>Az esemény egy helyen tartja a legfontosabb részleteket, így a résztvevők ugyanazokat az információkat látják jelentkezés vagy meghívás elfogadása előtt.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-20T09:15:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-trust-context-hu',
        lang: 'hu',
        title: 'Több háttér a találkozó előtt',
        excerpt: 'A profil, az eseményen betöltött szerep, a kapcsolódó csevegés és a benyomások segítenek megérteni, kivel találkozol.',
        contentHtml: `
          <p>A profil megmutathatja azokat az adatokat, amelyeket valaki megoszt magáról. Az esemény ehhez hozzáadja a tervet, valamint a tag szerepét vagy részvételét, az esemény- és csoportos csevegés pedig a programhoz köti a beszélgetést.</p>
          <p>A tényleges részvétel után a szervezők és a résztvevők külön esemény-visszajelzést adhatnak. Ez hozzájárulhat a szervezőről vagy tagról megjelenő benyomásokhoz, de nem garantálja, hogyan alakul egy későbbi találkozó.</p>
          <p>Ez a háttér csökkenti a bizonytalanságot, de mindenki maga dönti el, kivel szeretne találkozni.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-16T16:45:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-register-value-hu',
        lang: 'hu',
        title: 'Mire használható egy fiók?',
        excerpt: 'Hozz létre profilt, fedezz fel embereket és eseményeket, szervezz programot, csevegj és adj visszajelzést a részvétel után.',
        contentHtml: `
          <p>Regisztráció után létrehozhatod a profilodat, és beállíthatod a láthatóságát. Nyilvános profil szükséges ahhoz, hogy megjelenj a profilajánlásokban, és használd az emberek értékelésére szolgáló funkciókat.</p>
          <ul>
            <li>Fedezz fel és értékelj embereket, valamint böngéssz az elérhető események között.</li>
            <li>Jelentkezz eseményre, fogadj el meghívást, vagy szervezz és kezelj saját eseményt.</li>
            <li>Használj esemény-, csoportos és támogatási csevegést, majd adj visszajelzést a részvétel után.</li>
          </ul>
          <p>A fiókod megőrzi a profilodat és a tevékenységeidet, így később is visszatérhetsz a terveidhez és a beszélgetéseidhez.</p>
        `,
        featured: false,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-11T13:20:00.000Z'),
        nowIso
      })
    ];
    return [...enPosts, ...huPosts];
  }

  private static defaultPost(options: {
    id: string;
    lang: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    featured: boolean;
    submittedAtIso: string;
    nowIso: string;
  }): IdeaPostDto {
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

  private static rebaseSeedDateTime(value: string): string {
    return AppUtils.rebaseDateTime(value, SEED_SCHEDULE_REFERENCE_DATE, environment.bootstrapOffsetInDays) ?? value;
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
    return `${value ?? ''}`
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private static languageLabel(lang: string | null | undefined): string {
    const normalized = this.normalizeLang(lang);
    return APP_STATIC_DATA.contentLanguages.find(language => this.normalizeLang(language.lang) === normalized)?.label
      ?? (normalized === 'hu' ? 'Magyar' : 'English');
  }

  private static contentKeyFromId(id: string | null | undefined): string {
    const normalized = `${id ?? ''}`.trim();
    return normalized.endsWith('-hu') ? normalized.slice(0, -3) : normalized;
  }
}
