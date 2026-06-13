import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ExplanationGuideService } from '../../../core';
import type { HelpCenterSection } from '../../../core/contracts';
import { I18nPipe } from '../../pipes';
import { LazyBgImageDirective } from '../../directives';
import { ProgressIndicatorComponent } from '../progress-indicator';

type HomeFilterModeOption = Readonly<{
  key: string;
  label: string;
  icon: string;
}>;

type ExplanationSectionLayout = 'span-1' | 'span-2' | 'span-3';

@Component({
  selector: 'app-explanation-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, ProgressIndicatorComponent, I18nPipe],
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

  protected homeFilterModeOptions(lang: string | null | undefined): ReadonlyArray<HomeFilterModeOption> {
    return lang === 'hu'
      ? this.homeFilterModeOptionsHu
      : this.homeFilterModeOptionsEn;
  }

  protected shouldShowGeneratedVisual(section: HelpCenterSection): boolean {
    return !/<img[\s>]/i.test(this.sectionContentHtml(section));
  }

  protected sectionContentHtml(section: HelpCenterSection): string {
    const contentHtml = `${section.contentHtml ?? ''}`.trim();
    if (/<img[\s>]/i.test(contentHtml)) {
      return contentHtml;
    }
    const imageUrl = this.primarySectionImageUrl(section);
    if (!imageUrl) {
      return contentHtml;
    }
    const seededFigure = `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${this.escapeHtmlAttribute(this.lazyImagePlaceholderSrc(imageUrl))}" alt="${this.escapeHtmlAttribute(section.title ?? '')}"></figure>`;
    return `${contentHtml}${contentHtml ? '' : ''}${seededFigure}`;
  }

  protected sectionLayoutClass(section: HelpCenterSection): string | null {
    const layout = this.sectionLayout(section);
    return layout ? `explanation-popup__item--${layout}` : null;
  }

  private sectionLayout(section: HelpCenterSection): ExplanationSectionLayout | null {
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

  private primarySectionImageUrl(section: HelpCenterSection): string {
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
    const hu = lang === 'hu';
    const labels: Record<string, string> = hu
      ? {
          ratings: 'Értékelések',
          chats: 'Chatek',
          events: 'Események',
          preferences: 'Szimpátiák',
          suggestions: 'Ajánlások',
          given: 'adott',
          received: 'kapott',
          mutual: 'kölcsönös',
          met: 'találkozott',
          socialOn: 'Social on',
          socialOff: 'Social off',
          latest: 'Legutóbbi',
          relevant: 'Releváns',
          past: 'Korábbi',
          distance: 'Távolság',
          day: 'Nap',
          week: 'Hét',
          month: 'Hónap',
          rate: 'Értékelés',
          score: 'Pont',
          photos: 'Fotók',
          profile: 'Profil',
          fullscreen: 'Teljes képernyő',
          fullscreenExit: 'Kilépés',
          close: 'Bezárás',
          allEvents: 'Összes',
          activeEvents: 'Aktív',
          pending: 'Függő',
          invitations: 'Meghívások',
          myEvents: 'Saját',
          drafts: 'Piszkozat',
          trash: 'Kuka',
          upcoming: 'Közelgő',
          explore: 'Felfedezés',
          createEvent: 'Új esemény',
          eventTitle: 'Phoenix Sunday Walk',
          eventDate: 'Aug 29, 1:15 PM',
          eventPlace: 'Phoenix · 6.8 km',
          waitingApproval: 'Jóváhagyásra vár',
          members: 'Tagok',
          viewEvent: 'Megtekintés',
          editEvent: 'Szerkesztés',
          publish: 'Publikálás',
          accept: 'Elfogadás',
          contact: 'Szervező',
          share: 'Megosztás',
          leave: 'Kilépés',
          checkout: 'Fizetés',
          feedback: 'Visszajelzés',
          resources: 'Erőforrás',
          normalEvent: 'Normál',
          tournament: 'Bajnokság',
          autoInviter: 'Auto meghívó',
          priority: 'Prioritás',
          visibility: 'Láthatóság',
          publicEvent: 'Nyílt',
          friendsOnly: 'Ismerősök',
          invitationOnly: 'Csak meghívással',
          eventName: 'Név',
          capacity: 'Létszám',
          description: 'Leírás',
          openEvent: 'Nyílt esemény',
          blindEvent: 'Blind Event',
          topics: 'Topics',
          ticketing: 'Ticketing',
          datePanel: 'Dátum',
          oneTime: 'one-time',
          pricing: 'Pricing',
          policies: 'Event Policies',
          location: 'Helyszín',
          subEvents: 'Sub Events',
          mandatory: 'Mandatory',
          optional: 'Opcionális',
          casual: 'Casual',
          stage: 'Szakasz',
          group: 'Csoport',
          leaderboard: 'Ranglista',
          admin: 'Admin',
          manager: 'Manager',
          member: 'Member',
          invite: 'Meghívás',
          pendingOnly: 'Csak függő',
          approve: 'Jóváhagyás',
          reject: 'Elutasítás',
          remove: 'Eltávolítás',
          removeMember: 'Remove member',
          disqualify: 'Kizárás',
          restore: 'Visszaállítás',
          assign: 'Assign',
          car: 'Car',
          accommodation: 'Accommodation',
          property: 'Accommodation',
          supplies: 'Supplies',
          accepted: 'Elfogadott',
          capacityRange: 'Min-max',
          slots: 'Slotok',
          slotSetup: 'Slot Setup',
          map: 'Térkép',
          save: 'Mentés',
          allChats: 'Összes',
          eventChat: 'Esemény',
          subEventChat: 'Alesemény',
          groupChat: 'Csoport',
          serviceChat: 'Szerviz',
          unread: 'olvasatlan',
          chatTitle: 'Noah Hart',
          chatChannel: 'Phoenix Sunday Walk · Main Event',
          chatLast: 'Találkozó helye rendben?',
          chatMembers: '4 tag',
          writeMessage: 'Üzenet írása',
          pinned: 'Fontos',
          poll: 'Szavazás',
          voice: 'Hang',
          image: 'Kép',
          asset: 'Eszköz',
          eventShare: 'Esemény',
          mainEvent: 'Main event',
          subEvent: 'Sub event',
          groupChannel: 'Group',
          organizer: 'Organizer',
          sharedEvent: 'Megosztott esemény',
          sharedPoll: 'Szavazás',
          reply: 'Válasz',
          react: 'Reakció',
          more: 'Több',
          viewMessage: 'Megnyitás',
          editMessage: 'Szerkesztés',
          unsend: 'Visszavonás',
          pin: 'Fontosnak jelölés',
          report: 'Jelentés'
        }
      : {
          ratings: 'Ratings',
          chats: 'Chats',
          events: 'Events',
          preferences: 'Preferences',
          suggestions: 'Suggestions',
          given: 'given',
          received: 'received',
          mutual: 'mutual',
          met: 'met',
          socialOn: 'Social on',
          socialOff: 'Social off',
          latest: 'Latest',
          relevant: 'Relevant',
          past: 'Past',
          distance: 'Distance',
          day: 'Day',
          week: 'Week',
          month: 'Month',
          rate: 'Rate',
          score: 'Score',
          photos: 'Photos',
          profile: 'Profile',
          fullscreen: 'Fullscreen',
          fullscreenExit: 'Exit',
          close: 'Close',
          allEvents: 'All',
          activeEvents: 'Active',
          pending: 'Pending',
          invitations: 'Invites',
          myEvents: 'My Events',
          drafts: 'Drafts',
          trash: 'Trash',
          upcoming: 'Upcoming',
          explore: 'Explore',
          createEvent: 'Create Event',
          eventTitle: 'Phoenix Sunday Walk',
          eventDate: 'Aug 29, 1:15 PM',
          eventPlace: 'Phoenix · 6.8 km',
          waitingApproval: 'Waiting approval',
          members: 'Members',
          viewEvent: 'View',
          editEvent: 'Edit',
          publish: 'Publish',
          accept: 'Accept',
          contact: 'Organizer',
          share: 'Share',
          leave: 'Leave',
          checkout: 'Checkout',
          feedback: 'Feedback',
          resources: 'Resources',
          normalEvent: 'Normal',
          tournament: 'Tournament',
          autoInviter: 'Auto inviter',
          priority: 'Priority',
          visibility: 'Visibility',
          publicEvent: 'Public',
          friendsOnly: 'Friends only',
          invitationOnly: 'Invite only',
          eventName: 'Name',
          capacity: 'Capacity',
          description: 'Description',
          openEvent: 'Open Event',
          blindEvent: 'Blind Event',
          topics: 'Topics',
          ticketing: 'Ticketing',
          datePanel: 'Date',
          oneTime: 'one-time',
          pricing: 'Pricing',
          policies: 'Event Policies',
          location: 'Location',
          subEvents: 'Sub Events',
          mandatory: 'Mandatory',
          optional: 'Optional',
          casual: 'Casual',
          stage: 'Stage',
          group: 'Group',
          leaderboard: 'Leaderboard',
          admin: 'Admin',
          manager: 'Manager',
          member: 'Member',
          invite: 'Invite',
          pendingOnly: 'Pending only',
          approve: 'Approve',
          reject: 'Reject',
          remove: 'Remove',
          removeMember: 'Remove member',
          disqualify: 'Disqualify',
          restore: 'Restore',
          assign: 'Assign',
          car: 'Car',
          accommodation: 'Accommodation',
          property: 'Accommodation',
          supplies: 'Supplies',
          accepted: 'Accepted',
          capacityRange: 'Min-max',
          slots: 'Slots',
          slotSetup: 'Slot Setup',
          map: 'Map',
          save: 'Save',
          allChats: 'All',
          eventChat: 'Event',
          subEventChat: 'Sub event',
          groupChat: 'Group',
          serviceChat: 'Service',
          unread: 'unread',
          chatTitle: 'Noah Hart',
          chatChannel: 'Phoenix Sunday Walk · Main Event',
          chatLast: 'Meeting place looks good?',
          chatMembers: '4 members',
          writeMessage: 'Write message',
          pinned: 'Pinned',
          poll: 'Poll',
          voice: 'Voice',
          image: 'Image',
          asset: 'Asset',
          eventShare: 'Event',
          mainEvent: 'Main event',
          subEvent: 'Sub event',
          groupChannel: 'Group',
          organizer: 'Organizer',
          sharedEvent: 'Shared event',
          sharedPoll: 'Poll',
          reply: 'Reply',
          react: 'React',
          more: 'More',
          viewMessage: 'View',
          editMessage: 'Edit',
          unsend: 'Unsend',
          pin: 'Pin',
          report: 'Report'
        };
    return labels[key] ?? key;
  }

  protected assetText(lang: string | null | undefined, key: string): string {
    const hu = lang === 'hu';
    const labels: Record<string, string> = hu
      ? {
          assets: 'Eszközök',
          car: 'Autó',
          accommodation: 'Ingatlan',
          supplies: 'Kellékek',
          ticket: 'Jegy',
          add: 'Új',
          sourceLink: 'Forráslink',
          type: 'Típus',
          title: 'Cím',
          category: 'Kategória',
          capacity: 'Kapacitás',
          quantity: 'Mennyiség',
          details: 'Leírás',
          public: 'Public',
          friends: 'Friends only',
          inviteOnly: 'Invitation only',
          price: 'Asset Pricing',
          policies: 'Lending Policies',
          location: 'Helyszín',
          requests: 'Kérések',
          all: 'Összes',
          activeItems: 'Aktív elemek',
          pendingRequests: 'Függő kérések',
          borrowedItems: 'Kölcsönadva',
          pending: 'Függő',
          accepted: 'Elfogadva',
          manager: 'Manager',
          share: 'Megosztás',
          edit: 'Szerkesztés',
          delete: 'Törlés',
          accept: 'Jóváhagyás',
          reject: 'Elutasítás',
          makeManager: 'Manager',
          scan: 'Scan Ticket',
          qr: 'QR',
          upcoming: 'Közelgő',
          past: 'Korábbi',
          own: 'Saját eszköz',
          eventResource: 'Esemény-erőforrás',
          takeover: 'Átvétel',
          deletedOwner: 'Törölt tulaj',
          map: 'Térkép'
        }
      : {
          assets: 'Assets',
          car: 'Car',
          accommodation: 'Accommodation',
          supplies: 'Supplies',
          ticket: 'Ticket',
          add: 'Add',
          sourceLink: 'Source link',
          type: 'Type',
          title: 'Title',
          category: 'Category',
          capacity: 'Capacity',
          quantity: 'Quantity',
          details: 'Details',
          public: 'Public',
          friends: 'Friends only',
          inviteOnly: 'Invitation only',
          price: 'Asset Pricing',
          policies: 'Lending Policies',
          location: 'Location',
          requests: 'Requests',
          all: 'All',
          activeItems: 'Active items',
          pendingRequests: 'Pending requests',
          borrowedItems: 'Borrowed items',
          pending: 'Pending',
          accepted: 'Accepted',
          manager: 'Manager',
          share: 'Share',
          edit: 'Edit',
          delete: 'Delete',
          accept: 'Approve',
          reject: 'Reject',
          makeManager: 'Manager',
          scan: 'Scan Ticket',
          qr: 'QR',
          upcoming: 'Upcoming',
          past: 'Past',
          own: 'Own asset',
          eventResource: 'Event resource',
          takeover: 'Take over',
          deletedOwner: 'Deleted owner',
          map: 'Map'
        };
    return labels[key] ?? key;
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
    this.guide.dismiss();
  }
}
