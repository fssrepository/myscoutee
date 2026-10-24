import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  ExplanationGuideService,
  type GuideRevision as HelpCenterRevisionDto,
  type GuideSection as HelpCenterSectionDto,
  I18nPipe,
  LazyBgImageDirective,
  IndicatorComponent,
  PopupComponent,
  type PopupModel
} from '@fssrepository/myscoutee-components';
import * as AppConstants from '../../../core/common/constants';


type HomeFilterModeOption = Readonly<{
  key: string;
  label: string;
  icon: string;
}>;

type ExplanationSectionLayout = 'span-1' | 'span-2' | 'span-3';

const EXPLANATION_ACTIVITY_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  ratings: ['Értékelések', 'Ratings'],
  chats: ['Chatek', 'Chats'],
  events: ['Események', 'Events'],
  preferences: ['Szimpátiák', 'Preferences'],
  suggestions: ['Ajánlások', 'Suggestions'],
  given: ['adott', 'given'],
  received: ['kapott', 'received'],
  mutual: ['kölcsönös', 'mutual'],
  met: ['találkozott', 'met'],
  socialOn: ['Social on', 'Social on'],
  socialOff: ['Social off', 'Social off'],
  latest: ['Legutóbbi', 'Latest'],
  relevant: ['Releváns', 'Relevant'],
  past: ['Korábbi', 'Past'],
  distance: ['Távolság', 'Distance'],
  day: ['Nap', 'Day'],
  week: ['Hét', 'Week'],
  month: ['Hónap', 'Month'],
  rate: ['Értékelés', 'Rate'],
  score: ['Pont', 'Score'],
  photos: ['Fotók', 'Photos'],
  profile: ['Profil', 'Profile'],
  fullscreen: ['Teljes képernyő', 'Fullscreen'],
  fullscreenExit: ['Kilépés', 'Exit'],
  close: ['Bezárás', 'Close'],
  allEvents: ['Összes', 'All'],
  activeEvents: ['Aktív', 'Active'],
  pending: ['Függő', 'Pending'],
  invitations: ['Meghívások', 'Invites'],
  myEvents: ['Saját', 'My Events'],
  drafts: ['Piszkozat', 'Drafts'],
  trash: ['Kuka', 'Trash'],
  upcoming: ['Közelgő', 'Upcoming'],
  explore: ['Felfedezés', 'Explore'],
  createEvent: ['Új esemény', 'Create Event'],
  eventTitle: ['Phoenix Sunday Walk', 'Phoenix Sunday Walk'],
  eventDate: ['Aug 29, 1:15 PM', 'Aug 29, 1:15 PM'],
  eventPlace: ['Phoenix · 6.8 km', 'Phoenix · 6.8 km'],
  waitingApproval: ['Jóváhagyásra vár', 'Waiting approval'],
  members: ['Tagok', 'Members'],
  viewEvent: ['Megtekintés', 'View'],
  editEvent: ['Szerkesztés', 'Edit'],
  publish: ['Publikálás', 'Publish'],
  accept: ['Elfogadás', 'Accept'],
  contact: ['Szervező', 'Organizer'],
  share: ['Megosztás', 'Share'],
  leave: ['Kilépés', 'Leave'],
  checkout: ['Fizetés', 'Checkout'],
  feedback: ['Visszajelzés', 'Feedback'],
  resources: ['Erőforrás', 'Resources'],
  normalEvent: ['Normál', 'Normal'],
  tournament: ['Bajnokság', 'Tournament'],
  autoInviter: ['Auto meghívó', 'Auto inviter'],
  priority: ['Prioritás', 'Priority'],
  visibility: ['Láthatóság', 'Visibility'],
  publicEvent: ['Nyílt', 'Public'],
  friendsOnly: ['Ismerősök', 'Friends only'],
  invitationOnly: ['Csak meghívással', 'Invite only'],
  eventName: ['Név', 'Name'],
  capacity: ['Létszám', 'Capacity'],
  description: ['Leírás', 'Description'],
  openEvent: ['Nyílt esemény', 'Open Event'],
  blindEvent: ['Blind Event', 'Blind Event'],
  topics: ['Topics', 'Topics'],
  ticketing: ['Ticketing', 'Ticketing'],
  datePanel: ['Dátum', 'Date'],
  oneTime: ['one-time', 'one-time'],
  pricing: ['Pricing', 'Pricing'],
  policies: ['Event Policies', 'Event Policies'],
  location: ['Helyszín', 'Location'],
  subEvents: ['Sub Events', 'Sub Events'],
  mandatory: ['Mandatory', 'Mandatory'],
  optional: ['Opcionális', 'Optional'],
  casual: ['Casual', 'Casual'],
  stage: ['Szakasz', 'Stage'],
  group: ['Csoport', 'Group'],
  leaderboard: ['Ranglista', 'Leaderboard'],
  admin: ['Admin', 'Admin'],
  manager: ['Manager', 'Manager'],
  member: ['Member', 'Member'],
  invite: ['Meghívás', 'Invite'],
  pendingOnly: ['Csak függő', 'Pending only'],
  approve: ['Jóváhagyás', 'Approve'],
  reject: ['Elutasítás', 'Reject'],
  remove: ['Eltávolítás', 'Remove'],
  removeMember: ['Remove member', 'Remove member'],
  disqualify: ['Kizárás', 'Disqualify'],
  restore: ['Visszaállítás', 'Restore'],
  assign: ['Assign', 'Assign'],
  transport: [AppConstants.ASSET_TYPE_TRANSPORT, AppConstants.ASSET_TYPE_TRANSPORT],
  accommodation: [AppConstants.ASSET_TYPE_ACCOMMODATION, AppConstants.ASSET_TYPE_ACCOMMODATION],
  supplies: [AppConstants.ASSET_TYPE_SUPPLIES, AppConstants.ASSET_TYPE_SUPPLIES],
  accepted: ['Elfogadott', 'Accepted'],
  capacityRange: ['Min-max', 'Min-max'],
  slots: ['Slotok', 'Slots'],
  slotSetup: ['Slot Setup', 'Slot Setup'],
  map: ['Térkép', 'Map'],
  save: ['Mentés', 'Save'],
  allChats: ['Összes', 'All'],
  eventChat: ['Esemény', 'Event'],
  subEventChat: ['Alesemény', 'Sub event'],
  groupChat: ['Csoport', 'Group'],
  serviceChat: ['Szerviz', 'Service'],
  unread: ['olvasatlan', 'unread'],
  chatTitle: ['Noah Hart', 'Noah Hart'],
  chatChannel: ['Phoenix Sunday Walk · Main Event', 'Phoenix Sunday Walk · Main Event'],
  chatLast: ['Találkozó helye rendben?', 'Meeting place looks good?'],
  chatMembers: ['4 tag', '4 members'],
  writeMessage: ['Üzenet írása', 'Write message'],
  pinned: ['Fontos', 'Pinned'],
  poll: ['Szavazás', 'Poll'],
  voice: ['Hang', 'Voice'],
  image: ['Kép', 'Image'],
  asset: ['Eszköz', 'Asset'],
  eventShare: ['Esemény', 'Event'],
  mainEvent: ['Main event', 'Main event'],
  subEvent: ['Sub event', 'Sub event'],
  groupChannel: ['Group', 'Group'],
  organizer: ['Organizer', 'Organizer'],
  sharedEvent: ['Megosztott esemény', 'Shared event'],
  sharedPoll: ['Szavazás', 'Poll'],
  reply: ['Válasz', 'Reply'],
  react: ['Reakció', 'React'],
  more: ['Több', 'More'],
  viewMessage: ['Megnyitás', 'View'],
  editMessage: ['Szerkesztés', 'Edit'],
  unsend: ['Visszavonás', 'Unsend'],
  pin: ['Fontosnak jelölés', 'Pin'],
  report: ['Jelentés', 'Report']
};

const EXPLANATION_ASSET_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  assets: ['Eszközök', 'Assets'],
  transport: [AppConstants.ASSET_TYPE_TRANSPORT, AppConstants.ASSET_TYPE_TRANSPORT],
  accommodation: [AppConstants.ASSET_TYPE_ACCOMMODATION, AppConstants.ASSET_TYPE_ACCOMMODATION],
  supplies: ['Kellékek', AppConstants.ASSET_TYPE_SUPPLIES],
  ticket: ['Jegy', AppConstants.ASSET_FILTER_TICKET],
  add: ['Új', 'Add'],
  sourceLink: ['Forráslink', 'Source link'],
  type: ['Típus', 'Type'],
  title: ['Cím', 'Title'],
  category: ['Kategória', 'Category'],
  capacity: ['Kapacitás', 'Capacity'],
  quantity: ['Mennyiség', 'Quantity'],
  details: ['Leírás', 'Details'],
  public: ['Public', 'Public'],
  friends: ['Friends only', 'Friends only'],
  inviteOnly: ['Invitation only', 'Invitation only'],
  price: ['Asset Pricing', 'Asset Pricing'],
  policies: ['Lending Policies', 'Lending Policies'],
  location: ['Helyszín', 'Location'],
  requests: ['Kérések', 'Requests'],
  all: ['Összes', 'All'],
  activeItems: ['Aktív elemek', 'Active items'],
  pendingRequests: ['Függő kérések', 'Pending requests'],
  borrowedItems: ['Kölcsönadva', 'Borrowed items'],
  pending: ['Függő', 'Pending'],
  accepted: ['Elfogadva', 'Accepted'],
  manager: ['Manager', 'Manager'],
  share: ['Megosztás', 'Share'],
  edit: ['Szerkesztés', 'Edit'],
  delete: ['Törlés', 'Delete'],
  accept: ['Jóváhagyás', 'Approve'],
  reject: ['Elutasítás', 'Reject'],
  makeManager: ['Manager', 'Manager'],
  scan: ['Scan Ticket', 'Scan Ticket'],
  qr: ['QR', 'QR'],
  upcoming: ['Közelgő', 'Upcoming'],
  past: ['Korábbi', 'Past'],
  own: ['Saját eszköz', 'Own asset'],
  eventResource: ['Esemény-erőforrás', 'Event resource'],
  takeover: ['Átvétel', 'Take over'],
  deletedOwner: ['Törölt tulaj', 'Deleted owner'],
  map: ['Térkép', 'Map']
};

@Component({
  selector: 'app-explanation-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, IndicatorComponent, I18nPipe, PopupComponent],
  templateUrl: './explanation-popup.component.html',
  styleUrl: './explanation-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExplanationPopupComponent {
  protected readonly guide = inject(ExplanationGuideService);
  protected readonly popupOpen = this.guide.popupOpen;
  protected readonly loading = this.guide.loading;
  protected readonly activeRevision = this.guide.visibleRevision;
  private readonly lazyImagePlaceholderUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  private readonly fallbackWideSectionIds = new Set<string>([
    'affinity-network',
    'activity-chat-message-window',
    'assets-editor',
    'assets-requests',
    'event-editor-main',
    'event-editor-subevents'
  ]);
  protected readonly homeFilterModeOptionsEn: ReadonlyArray<HomeFilterModeOption> = [
    { key: 'single', label: 'Preferences', icon: 'person' },
    { key: 'friends-in-common', label: 'Friends in Common', icon: 'diversity_3' },
    { key: 'separated-friends', label: 'Inside Network', icon: 'group_add' },
    { key: 'pair', label: 'Outside Network', icon: 'groups' }
  ];
  protected readonly homeFilterModeOptionsHu: ReadonlyArray<HomeFilterModeOption> = [
    { key: 'single', label: 'Preferenciák', icon: 'person' },
    { key: 'friends-in-common', label: 'Közös ismerősök', icon: 'diversity_3' },
    { key: 'separated-friends', label: 'Hálózaton belül', icon: 'group_add' },
    { key: 'pair', label: 'Hálózaton kívül', icon: 'groups' }
  ];

  protected explanationPopupModel(revision: HelpCenterRevisionDto): PopupModel {
    return {
      title: revision.title,
      translateTitle: false,
      ariaLabel: revision.title,
      size: 'wide',
      height: 'full',
      headerLayout: 'document',
      headerPalette: revision.headerColor ?? 'slate',
      headerTitleTone: 'neutral',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected loadingExplanationPopupModel(): PopupModel {
    return {
      ariaLabel: 'explanation.loading.aria',
      size: 'wide',
      height: 'full',
      headerLayout: 'document',
      headerPalette: 'slate',
      headerTitleTone: 'neutral',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected explanationPopupZIndex(): number {
    return 23000;
  }

  protected homeFilterModeOptions(lang: string | null | undefined): ReadonlyArray<HomeFilterModeOption> {
    return lang === 'hu'
      ? this.homeFilterModeOptionsHu
      : this.homeFilterModeOptionsEn;
  }

  protected shouldShowGeneratedVisual(section: HelpCenterSectionDto): boolean {
    return !/<img[\s>]/i.test(this.sectionContentHtml(section));
  }

  protected sectionContentHtml(section: HelpCenterSectionDto): string {
    const contentHtml = `${section.contentHtml ?? ''}`.trim();
    if (/<img[\s>]/i.test(contentHtml)) {
      return contentHtml;
    }
    const imageUrl = this.primarySectionImageUrl(section);
    if (!imageUrl) {
      return contentHtml;
    }
    const seededFigure = `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${this.escapeHtmlAttribute(this.lazyImagePlaceholderSrc(imageUrl))}" alt="${this.escapeHtmlAttribute(section.title ?? '')}"></figure>`;
    return `${contentHtml}${seededFigure}`;
  }

  protected sectionLayoutClass(section: HelpCenterSectionDto): string | null {
    const layout = this.sectionLayout(section);
    return layout ? `explanation-popup__item--${layout}` : null;
  }

  private sectionLayout(section: HelpCenterSectionDto): ExplanationSectionLayout | null {
    const panelSpan = this.normalizeSectionLayout(section.panelSpan);
    if (panelSpan) {
      return panelSpan;
    }
    const marker = this.sectionLayoutMarker(section.contentHtml ?? '');
    if (marker) {
      return marker;
    }
    return this.fallbackWideSectionIds.has(section.id) ? 'span-2' : null;
  }

  private sectionLayoutMarker(contentHtml: string): ExplanationSectionLayout | null {
    const commentMarker = /<!--\s*(?:panel|layout|section|width)\s*:\s*([a-z0-9_-]+)\s*-->/i.exec(contentHtml)?.[1];
    const attributeMarker = /\b(?:data-panel|data-layout|data-section|data-width|data-panel-width)\s*=\s*["']\s*([a-z0-9_-]+)\s*["']/i.exec(contentHtml)?.[1];
    const classMarker = /\b(?:help|explanation|section|panel)-(?:panel|section|layout)--([a-z0-9_-]+)\b/i.exec(contentHtml)?.[1];
    return this.normalizeSectionLayout(commentMarker ?? attributeMarker ?? classMarker);
  }

  private normalizeSectionLayout(value: string | null | undefined): ExplanationSectionLayout | null {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized === 'span-1' || normalized === 'compact' || normalized === 'single' || normalized === 'one' || normalized === '1') {
      return 'span-1';
    }
    if (normalized === 'span-2' || normalized === 'wide' || normalized === 'double' || normalized === 'two' || normalized === '2') {
      return 'span-2';
    }
    if (normalized === 'span-3' || normalized === 'full' || normalized === 'row' || normalized === 'all' || normalized === '3') {
      return 'span-3';
    }
    return null;
  }

  private primarySectionImageUrl(section: HelpCenterSectionDto): string {
    return `${section.imageUrls?.[0] ?? ''}`.trim();
  }

  private lazyImagePlaceholderSrc(imageUrl: string): string {
    return `${this.lazyImagePlaceholderUrl}#lazy-src=${encodeURIComponent(imageUrl)}`;
  }

  private escapeHtmlAttribute(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  protected activityText(lang: string | null | undefined, key: string): string {
    return EXPLANATION_ACTIVITY_LABELS[key]?.[lang === 'hu' ? 0 : 1] ?? key;
  }

  protected assetText(lang: string | null | undefined, key: string): string {
    return EXPLANATION_ASSET_LABELS[key]?.[lang === 'hu' ? 0 : 1] ?? key;
  }

  protected affinityText(lang: string | null | undefined, key: string): string {
    const hu = lang === 'hu';
    const labels: Record<string, string> = hu
      ? {
          mutual: 'Kölcsönös érdeklődés',
          group: '6-12 fős csoportchat',
          you: 'Te',
          match: 'Chat',
          strong: 'erős kapcsolat',
          medium: 'közepes',
          light: 'gyengébb'
        }
      : {
          mutual: 'Mutual interest',
          group: '6-12 person group chat',
          you: 'You',
          match: 'Chat',
          strong: 'strong link',
          medium: 'medium',
          light: 'lighter'
        };
    return labels[key] ?? key;
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.guide.closePopup();
  }
}
