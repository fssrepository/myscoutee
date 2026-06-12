import { APP_STATIC_DATA } from '../../../app-static-data';
import type { IdeaPost } from '../../base/models';
import { LocalSeedScheduleBuilder } from './seed-schedule.builder';

export class LocalIdeaPostsSeedBuilder {
  static buildDefaultPosts(): IdeaPost[] {
    const nowIso = new Date().toISOString();
    const enPosts = [
      this.defaultPost({
        id: 'idea-why-priority-matching',
        lang: 'en',
        title: 'How preferences become small group meetups',
        excerpt: 'MyScoutee helps people who do not already know each other form small real-world group meetups from preference signals, then learn from feedback after they actually meet.',
        contentHtml: `
          <p><strong>MyScoutee is not just a profile browser. It is a way to organize small group meetups between people who do not already know each other, using preferences as the starting signal.</strong></p>
          <p>The starting point can be a walk, brunch, board-game afternoon, sport session, coffee, or any small local plan. People show who they would like to meet and what kind of activity feels comfortable; the host or the system can then shape those signals into a group that has enough shared interest to make sense.</p>
          <p>This is why the priority score matters. It does not exist only to rank profiles. It helps MyScoutee understand which strangers are worth putting in the same social context, who should be invited first, and when a meetup has enough mutual preference to become a real plan.</p>
          <p>Preferences are not fixed forever. Before meeting, a 1-10 score is an early signal: who seems interesting, what kind of plan feels comfortable, and how much energy someone wants to invest.</p>
          <p>After a meetup, feedback becomes a reality check. People can rate each other up or down based on the actual experience: better than expected, about the same, or not quite the right fit.</p>
          <p>The goal is not simply a match. The goal is a small event with a reason, a time, a place, a capacity, and clearer expectations before people start talking.</p>
          <ul>
            <li>Preference scores give more nuance than a binary yes/no swipe.</li>
            <li>Before: preference scores show interest and comfort with the plan.</li>
            <li>After: satisfaction feedback shows how the real interaction landed.</li>
            <li>Hosts can manage capacity, invitations, requests, and participant visibility.</li>
          </ul>
          <p>In short: you describe the kind of people and activity you are open to, and MyScoutee helps turn that signal into a practical group meetup, then learn from what worked.</p>
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
          <p>One-to-one chat can put too much pressure on the first message. If two strangers only have a profile photo and a blank text box, the conversation often starts like an interview or fades before it becomes a plan.</p>
          <p>MyScoutee treats meeting as a social activity first. A group chat, host, or event gives people a shared frame before they have to perform chemistry. That frame can be as simple as a walk, a game night, a brunch, or a small local activity.</p>
          <p>Because the plan is visible, the first message has something real to react to. People can ask about the event, confirm expectations, and see who else is involved before deciding how much energy to invest.</p>
          <figure>
            <img src="@image_url" alt="People joining a social event">
            <figcaption>Shared plans give people something real to react to.</figcaption>
          </figure>
          <p>This makes introductions feel more natural: less isolated browsing, more shared momentum, and a lower-pressure path toward meeting offline.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case',
        lang: 'en',
        title: 'Host a small event and let the right people join',
        excerpt: 'Hosts can describe the plan, capacity, resources, and tone before inviting or approving members.',
        contentHtml: `
          <p>Imagine a host who wants to organize a Sunday board-game afternoon for six people. In a normal chat, the details quickly scatter: who is coming, where it is, whether food is needed, who can bring a game, and whether new people are welcome.</p>
          <p>In MyScoutee, the event itself can hold that structure. The host can describe the plan, set capacity, add optional parts, assign resources, invite specific people, or keep the event public for discovery.</p>
          <p>That matters because hosting is not only publishing a title. Good hosting is expectation management: who fits the tone, what commitment is required, and what participants should know before joining.</p>
          <ul>
            <li>Use it for brunches, walks, games, sport sessions, workshops, or low-pressure meetups.</li>
            <li>Keep the vibe and group size clear before people request a spot.</li>
            <li>Move logistics out of scattered messages and into one event context.</li>
          </ul>
          <p>For participants, this reduces uncertainty. For hosts, it makes social planning repeatable instead of fragile.</p>
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
          <p>Trust does not come from a profile photo alone. It grows when people can understand behavior: how someone joins, hosts, communicates, follows through, and participates in shared plans.</p>
          <p>MyScoutee keeps more of that context attached. A profile can show identity and preferences, an event can show role and participation, and a scoped chat can keep conversation tied to a specific plan instead of one endless thread.</p>
          <p>Feedback also becomes more useful when it is connected to real activity. After an event, signals can help improve future recommendations without turning every interaction into a public rating contest.</p>
          <ul>
            <li>Profiles explain who someone is trying to meet and what they care about.</li>
            <li>Event participation shows where a connection can happen naturally.</li>
            <li>Scoped chats keep communication focused on the plan at hand.</li>
          </ul>
          <p>The product still needs human judgment, but it can reduce guesswork by keeping the important social context visible.</p>
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
          <p>The landing page explains the idea, but registration is what gives the system enough context to become personal. A profile tells MyScoutee who you are, what kind of connection you are open to, and which activities make sense for you.</p>
          <p>Once that context exists, the product can do more than display generic content. It can prioritize people, show relevant events, support invitations, coordinate chats, and learn from feedback after real social activity.</p>
          <p>Registration also unlocks continuity. Instead of starting over each visit, your preferences, history, hosting activity, and conversations can shape the next recommendation.</p>
          <ul>
            <li>Discover people through priority signals, activities, and shared context.</li>
            <li>Join or host plans with clearer expectations before the first message.</li>
            <li>Use feedback and history to make the next match or event more relevant.</li>
          </ul>
          <p>In short: the public site is the explanation, while the registered experience is the social planning tool.</p>
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
        title: 'Kiscsoportos találkozók preferenciák alapján',
        excerpt: 'A MyScoutee olyan emberekből segít kis csoportos találkozót szervezni, akik még nem ismerik egymást, de a preferenciáik és a találkozás utáni visszajelzéseik alapján passzolhatnak.',
        contentHtml: `
          <p><strong>A MyScoutee nem csak profilnézegető. Arra való, hogy preferenciák alapján kis csoportos találkozók jöjjenek létre olyan emberek között, akik még nem ismerik egymást.</strong></p>
          <p>A kiindulás lehet séta, brunch, társasjáték, sport, kávézás vagy bármilyen kis helyi program. A résztvevők jelzik, kikkel és milyen helyzetben találkoznának szívesen; a szervező vagy a rendszer pedig ezekből a jelekből próbál életképes csoportot formálni.</p>
          <p>Ezért fontos a preferencia-pontszám. Nem csak profilok rangsorolására való. Segít megérteni, melyik idegeneket érdemes ugyanabba a társas helyzetbe tenni, kit érdemes először meghívni, és mikor van elég kölcsönös érdeklődés ahhoz, hogy a találkozóból valódi terv legyen.</p>
          <p>A preferencia nem végleges. Találkozás előtt az 1-10 pontszám inkább előzetes jel: ki tűnik érdekesnek, milyen program komfortos, és mennyi energiát tennél bele.</p>
          <p>Találkozás után már van valós élmény. Ilyenkor a visszajelzés arról szólhat, hogy az ember feljebb vagy lejjebb pontozná-e a másikat az élmény alapján: jobb volt-e, ugyanolyan, vagy nem igazán passzolt.</p>
          <p>A cél tehát nem önmagában a match, hanem egy konkrét kis esemény: ok, időpont, hely, létszám és tisztább elvárások még az első beszélgetés előtt.</p>
          <ul>
            <li>A preferencia-pontszám árnyaltabb jel, mint egy igen/nem swipe.</li>
            <li>Előtte a pontszám érdeklődést és komfortot mutat.</li>
            <li>Utána az elégedettségi visszajelzés megmutatja, hogyan sikerült a valódi találkozás.</li>
            <li>A szervező kezelheti a létszámot, meghívásokat, jelentkezéseket és láthatóságot.</li>
          </ul>
          <p>Röviden: megadod, milyen emberekkel és milyen programban találkoznál, a MyScoutee pedig segít ebből valódi kis csoportos találkozót szervezni, majd tanulni abból, mi működött.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-29T10:00:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-social-first-dating-hu',
        lang: 'hu',
        title: 'Magányos böngészésből közösségi találkozás',
        excerpt: 'A csoportok, szervezők és eseménykontextus természetesebbé és kevésbé nyomasztóvá teszik a bemutatkozást.',
        contentHtml: `
          <p>A MyScoutee akkor hasznos, amikor valaki úgy szeretne emberekkel találkozni, hogy ne minden beszélgetés interjúnak érződjön.</p>
          <p>Az egy-egy üzenetváltás túl nagy nyomást tehet az első mondatra. Ha két embernek csak egy profilképe és egy üres chatablaka van, a beszélgetés könnyen kihallgatásnak tűnik, vagy elhal, mielőtt terv lenne belőle.</p>
          <p>Egy csoport, szervező vagy esemény közös keretet ad. Lehet ez séta, társasjáték, brunch, sport vagy bármilyen kis helyi program, ahol az első üzenet már nem a semmiből indul.</p>
          <p>Így a bemutatkozás természetesebb: kevesebb magányos böngészés, több közös lendület, és alacsonyabb nyomás az offline találkozás előtt.</p>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-24T12:30:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-host-use-case-hu',
        lang: 'hu',
        title: 'Szervezz kis eseményt, és engedd csatlakozni a megfelelő embereket',
        excerpt: 'A szervezők még meghívás vagy jóváhagyás előtt leírhatják a tervet, létszámot, erőforrásokat és hangulatot.',
        contentHtml: `
          <p>Képzelj el egy vasárnapi társasjáték-délutánt hat fővel. Egy sima chatben gyorsan szétszóródnak a részletek: ki jön, hol lesz, kell-e étel, ki hoz játékot, és jöhetnek-e új emberek.</p>
          <p>A MyScoutee-ben maga az esemény hordozhatja ezt a struktúrát. A szervező leírhatja a tervet, létszámot állíthat, opcionális részeket adhat hozzá, erőforrásokat rendelhet, meghívhat konkrét embereket, vagy nyilvánossá teheti a programot.</p>
          <p>Ez azért fontos, mert a jó szervezés nem csak cím publikálása. Elváráskezelés is: milyen hangulat illik oda, milyen részvétel kell, és mit tudjon valaki, mielőtt csatlakozik.</p>
          <ul>
            <li>Jó brunchhoz, sétához, játékhoz, sporthoz, workshophoz vagy laza találkozóhoz.</li>
            <li>A hangulat és a csoportméret már a jelentkezés előtt tisztább.</li>
            <li>A logisztika nem szóródik szét sok külön üzenetben.</li>
          </ul>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-20T09:15:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-trust-context-hu',
        lang: 'hu',
        title: 'A bizalom gyorsabban nő, ha a kontextus megmarad',
        excerpt: 'Profilok, eseménytörténet, visszajelzés és célzott csevegések segítik megérteni, kivel találkozol.',
        contentHtml: `
          <p>A bizalom nem csak profilképből épül. Abból is, hogy valaki hogyan csatlakozik, hogyan szervez, hogyan kommunikál, betartja-e a terveket, és milyen szerepet vállal közös helyzetekben.</p>
          <p>A MyScoutee több ilyen kontextust tart együtt. A profil megmutathatja az identitást és preferenciákat, az esemény a szerepet és részvételt, a célzott chat pedig a beszélgetést egy konkrét tervhez köti.</p>
          <p>A visszajelzés is hasznosabb, ha valódi aktivitáshoz kapcsolódik. Egy esemény után a jelek javíthatják a következő ajánlásokat anélkül, hogy minden interakció nyilvános értékelési versennyé válna.</p>
          <ul>
            <li>A profil segít megérteni, kit és milyen helyzetet keres valaki.</li>
            <li>Az eseményrészvétel megmutatja, hol történhet természetesen a kapcsolat.</li>
            <li>A célzott csevegés a konkrét tervre fókuszálja a kommunikációt.</li>
          </ul>
        `,
        featured: true,
        submittedAtIso: this.rebaseSeedDateTime('2026-04-16T16:45:00.000Z'),
        nowIso
      }),
      this.defaultPost({
        id: 'idea-register-value-hu',
        lang: 'hu',
        title: 'Mit nyit meg a regisztráció',
        excerpt: 'A regisztrációból lesz párosítás, eseményfelfedezés, szervezés, chat és visszajelzés.',
        contentHtml: `
          <p>A landing oldal elmagyarázza az ötletet, de a rendszer akkor válik személyessé, amikor regisztrálsz és profilt építesz. A profil elmondja, ki vagy, milyen kapcsolódásra vagy nyitott, és milyen aktivitások illenek hozzád.</p>
          <p>Innentől a MyScoutee nem csak általános tartalmat mutat. Prioritást adhat embereknek, releváns eseményeket hozhat elő, meghívásokat támogathat, csevegéseket koordinálhat, és tanulhat a valódi közösségi aktivitás utáni visszajelzésekből.</p>
          <p>A regisztráció folytonosságot is ad: nem minden látogatás indul nulláról, mert a preferenciák, előzmények, szervezések és beszélgetések alakíthatják a következő ajánlást.</p>
          <ul>
            <li>Emberek felfedezése prioritások, aktivitások és közös kontextus alapján.</li>
            <li>Tervekhez csatlakozás vagy szervezés tisztább elvárásokkal.</li>
            <li>Visszajelzés és előzmények használata, hogy a következő találat vagy esemény relevánsabb legyen.</li>
          </ul>
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

  private static rebaseSeedDateTime(value: string): string {
    return LocalSeedScheduleBuilder.rebaseDateTime(value) ?? value;
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
