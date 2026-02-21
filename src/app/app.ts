import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule } from '@angular/forms';
import { AlertService } from './shared/alert.service';
import {
  DEMO_CHAT_BY_USER,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_INVITATIONS_BY_USER,
  DemoUser,
  DEMO_USERS,
  EVENT_EDITOR_SAMPLE,
  PROFILE_DETAILS,
  PROFILE_EXPERIENCE,
  PROFILE_PERSONALITY_TOP3,
  PROFILE_PILLARS,
  PROFILE_PRIORITY_TAGS,
  ChatMenuItem,
  EventMenuItem,
  HostingMenuItem,
  InvitationMenuItem
} from './shared/demo-data';
import { environment } from '../environments/environment';

type AccordionSection = 'chat' | 'invitations' | 'events' | 'hosting';
type MenuSection = 'game' | AccordionSection;

type PopupType =
  | 'chat'
  | 'chatMembers'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'menuEvent'
  | 'hostingEvent'
  | 'invitationActions'
  | 'eventEditor'
  | 'eventExplore'
  | 'profileEditor'
  | 'imageEditor'
  | 'imageUpload'
  | 'supplyDetail'
  | 'logoutConfirm'
  | null;

interface SupplyContext {
  subEventId: string;
  subEventTitle: string;
  type: string;
}

interface ChatReadAvatar {
  id: string;
  initials: string;
  gender: 'woman' | 'man';
}

interface ChatPopupMessage {
  id: string;
  sender: string;
  senderAvatar: ChatReadAvatar;
  text: string;
  time: string;
  mine: boolean;
  readBy: ChatReadAvatar[];
}

type SubEventCard = (typeof EVENT_EDITOR_SAMPLE.subEvents)[number];
type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatChipsModule,
    MatAutocompleteModule,
    FormsModule
  ],
  templateUrl: './app.html',
  styleUrl: '../_styles/app.scss'
})
export class App {
  public readonly alertService = inject(AlertService);

  protected readonly users = DEMO_USERS;
  protected readonly profileTopTraits = PROFILE_PERSONALITY_TOP3;
  protected readonly profilePriorityTags = PROFILE_PRIORITY_TAGS;
  protected readonly profilePillars = PROFILE_PILLARS;
  protected readonly profileDetails = PROFILE_DETAILS;
  protected readonly profileExperience = PROFILE_EXPERIENCE;
  protected readonly eventEditor = EVENT_EDITOR_SAMPLE;
  protected readonly physiqueOptions = ['Slim', 'Lean', 'Athletic', 'Fit', 'Curvy', 'Average', 'Muscular'];
  protected languageSuggestions = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Hungarian',
    'Romanian',
    'Polish',
    'Dutch',
    'Turkish',
    'Arabic',
    'Hindi',
    'Japanese',
    'Korean',
    'Mandarin'
  ];
  protected readonly profileStatusOptions: Array<{ value: ProfileStatus; icon: string }> = [
    { value: 'public', icon: 'public' },
    { value: 'friends only', icon: 'groups' },
    { value: 'host only', icon: 'stadium' },
    { value: 'inactive', icon: 'visibility_off' }
  ];

  protected showUserMenu = false;
  protected showUserSelector = !environment.loginEnabled;
  protected activePopup: PopupType = null;
  protected stackedPopup: PopupType = null;
  protected activeUserId = this.getInitialUserId();

  protected sectionsOpen: Record<AccordionSection, boolean> = {
    chat: true,
    invitations: false,
    events: false,
    hosting: false
  };
  protected activeMenuSection: MenuSection = 'chat';

  protected selectedChat: ChatMenuItem | null = null;
  protected selectedChatMembers: DemoUser[] = [];
  protected selectedChatMembersItem: ChatMenuItem | null = null;
  protected selectedInvitation: InvitationMenuItem | null = null;
  protected selectedEvent: EventMenuItem | null = null;
  protected selectedHostingEvent: HostingMenuItem | null = null;

  protected imageSlots: Array<string | null> = [null, null, null, null, null, null, null, null];
  protected selectedImageIndex = 0;
  protected uploadTargetIndex = 0;
  protected pendingUploadPreview: string | null = null;

  protected eventSupplyTypes: string[] = ['Cars', 'Members', 'Accessories', 'Accommodation'];
  protected newSupplyType = '';
  protected selectedSupplyContext: SupplyContext | null = null;

  protected profileForm = {
    fullName: '',
    birthday: null as Date | null,
    city: '',
    heightCm: null as number | null,
    physique: '',
    languages: [] as string[],
    horoscope: '',
    profileStatus: 'public' as ProfileStatus,
    hostTier: '',
    traitLabel: '',
    about: ''
  };
  protected languageInput = '';
  protected showLanguagePanel = false;

  constructor(private readonly router: Router) {
    this.syncProfileFormFromActiveUser();
    this.router.navigate(['/game']);
  }

  protected get activeUser() {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected get userBadgeCount(): number {
    return this.gameBadge + this.chatBadge + this.invitationsBadge + this.eventsBadge + this.hostingBadge;
  }

  protected get gameBadge(): number {
    return this.activeUser.activities.game;
  }

  protected get chatBadge(): number {
    return this.resolveSectionBadge(
      this.chatItems.map(item => item.unread),
      this.chatItems.length
    );
  }

  protected get invitationsBadge(): number {
    return this.resolveSectionBadge(
      this.invitationItems.map(item => item.unread),
      this.invitationItems.length
    );
  }

  protected get eventsBadge(): number {
    return this.resolveSectionBadge(
      this.eventItems.map(item => item.activity),
      this.eventItems.length
    );
  }

  protected get hostingBadge(): number {
    return this.resolveSectionBadge(
      this.hostingItems.map(item => item.activity),
      this.hostingItems.length
    );
  }

  protected get chatItems(): ChatMenuItem[] {
    return DEMO_CHAT_BY_USER[this.activeUser.id] ?? DEMO_CHAT_BY_USER['u1'];
  }

  protected get invitationItems(): InvitationMenuItem[] {
    return DEMO_INVITATIONS_BY_USER[this.activeUser.id] ?? DEMO_INVITATIONS_BY_USER['u1'];
  }

  protected get eventItems(): EventMenuItem[] {
    return DEMO_EVENTS_BY_USER[this.activeUser.id] ?? DEMO_EVENTS_BY_USER['u1'];
  }

  protected get hostingItems(): HostingMenuItem[] {
    return DEMO_HOSTING_BY_USER[this.activeUser.id] ?? DEMO_HOSTING_BY_USER['u1'];
  }

  protected get hasOpenAccordion(): boolean {
    return this.sectionsOpen.chat || this.sectionsOpen.invitations || this.sectionsOpen.events || this.sectionsOpen.hosting;
  }

  protected get isGameSelected(): boolean {
    return this.activeMenuSection === 'game' && !this.hasOpenAccordion;
  }

  protected onUserSelect(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  protected closeUserMenu(): void {
    this.showUserMenu = false;
  }

  protected toggleSection(section: AccordionSection): void {
    if (this.sectionsOpen[section]) {
      this.activeMenuSection = section;
      return;
    }
    this.sectionsOpen = {
      chat: false,
      invitations: false,
      events: false,
      hosting: false
    };
    this.sectionsOpen[section] = true;
    this.activeMenuSection = section;
  }

  protected goToGame(): void {
    this.activeMenuSection = 'game';
    this.router.navigate(['/game']);
    this.closeUserMenu();
  }

  protected openChatItem(item: ChatMenuItem): void {
    this.activeMenuSection = 'chat';
    this.selectedChat = item;
    this.stackedPopup = null;
    this.activePopup = 'chat';
    this.scrollChatToBottom();
    this.closeUserMenu();
  }

  protected openChatMembers(item: ChatMenuItem, event?: Event, stacked = false): void {
    event?.stopPropagation();
    this.selectedChatMembersItem = item;
    this.selectedChatMembers = this.getChatMembersById(item.id);
    if (stacked || this.activePopup === 'chat' || this.stackedPopup !== null) {
      this.stackedPopup = 'chatMembers';
      return;
    }
    this.activePopup = 'chatMembers';
    this.closeUserMenu();
  }

  protected openInvitationItem(item: InvitationMenuItem): void {
    this.activeMenuSection = 'invitations';
    this.selectedInvitation = item;
    this.activePopup = 'invitationActions';
    this.closeUserMenu();
  }

  protected openEventItem(item: EventMenuItem): void {
    this.activeMenuSection = 'events';
    this.selectedEvent = item;
    this.activePopup = 'menuEvent';
    this.closeUserMenu();
  }

  protected openHostingItem(item: HostingMenuItem): void {
    this.activeMenuSection = 'hosting';
    this.selectedHostingEvent = item;
    this.activePopup = 'hostingEvent';
    this.closeUserMenu();
  }

  protected openEventExplore(): void {
    this.activeMenuSection = 'events';
    if (this.stackedPopup !== null) {
      this.stackedPopup = 'eventExplore';
      return;
    }
    this.activePopup = 'eventExplore';
    this.closeUserMenu();
  }

  protected openEventEditor(stacked = false): void {
    if (stacked || this.stackedPopup !== null || this.activePopup === 'chat') {
      this.stackedPopup = 'eventEditor';
      return;
    }
    this.activePopup = 'eventEditor';
  }

  protected openProfileEditor(): void {
    this.syncProfileFormFromActiveUser();
    this.activePopup = 'profileEditor';
    this.closeUserMenu();
  }

  protected openImageEditor(): void {
    this.activePopup = 'imageEditor';
  }

  protected openImageUpload(index: number): void {
    this.uploadTargetIndex = index;
    this.pendingUploadPreview = this.imageSlots[index];
    this.activePopup = 'imageUpload';
  }

  protected openLogoutConfirm(): void {
    this.activePopup = 'logoutConfirm';
  }

  protected closePopup(): void {
    this.activePopup = null;
    this.stackedPopup = null;
  }

  protected closeStackedPopup(): void {
    this.stackedPopup = null;
    if (this.activePopup === 'chat') {
      this.scrollChatToBottom();
    }
  }

  protected confirmLogout(): void {
    this.activePopup = null;
    this.stackedPopup = null;
    if (!environment.loginEnabled) {
      this.showUserSelector = true;
    }
  }

  protected selectLoginUser(userId: string): void {
    this.activeUserId = userId;
    localStorage.setItem('demo-active-user', userId);
    this.syncProfileFormFromActiveUser();
    this.activeMenuSection = 'chat';
    this.sectionsOpen = {
      chat: true,
      invitations: false,
      events: false,
      hosting: false
    };
    window.dispatchEvent(new CustomEvent('active-user-changed'));
    this.showUserSelector = false;
    this.activePopup = null;
    this.stackedPopup = null;
    this.router.navigate(['/game']);
  }

  protected openUserSelector(): void {
    this.showUserSelector = true;
    this.closeUserMenu();
  }

  protected getPopupTitle(): string {
    switch (this.activePopup) {
      case 'chat':
        return this.selectedChat?.title ?? 'Chat';
      case 'chatMembers':
        return 'Chat Members';
      case 'invitationActions':
        return this.selectedInvitation?.description ?? 'Invitation';
      case 'menuEvent':
        return this.selectedEvent?.title ?? 'Event';
      case 'hostingEvent':
        return this.selectedHostingEvent?.title ?? 'Hosting Event';
      case 'eventEditor':
        return 'Event Editor';
      case 'eventExplore':
        return 'Event Explore';
      case 'profileEditor':
        return 'Profile Editor';
      case 'imageEditor':
        return 'Image Editor';
      case 'imageUpload':
        return 'Upload Image';
      case 'supplyDetail':
        return `${this.selectedSupplyContext?.type ?? 'Supply'} · ${this.selectedSupplyContext?.subEventTitle ?? ''}`.trim();
      case 'invitations':
        return 'Invitations';
      case 'events':
        return 'Events';
      case 'hosting':
        return 'Hosting';
      case 'logoutConfirm':
        return 'Kilépés';
      default:
        return '';
    }
  }

  protected getStackedPopupTitle(): string {
    switch (this.stackedPopup) {
      case 'chatMembers':
        return 'Chat Members';
      case 'eventEditor':
        return 'Event Editor';
      case 'eventExplore':
        return 'Event Explore';
      case 'supplyDetail':
        return `${this.selectedSupplyContext?.type ?? 'Supply'} · ${this.selectedSupplyContext?.subEventTitle ?? ''}`.trim();
      default:
        return '';
    }
  }

  protected privacyIcon(value: 'Public' | 'Friends' | 'Hosts' | 'Private'): string {
    switch (value) {
      case 'Public':
        return '🔓';
      case 'Friends':
        return '👥';
      case 'Hosts':
        return '🎤';
      default:
        return '🔒';
    }
  }

  protected profileStatusClass(value: ProfileStatus = this.activeUser.profileStatus): string {
    switch (value) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected getProfileStatusIcon(value: ProfileStatus = this.activeUser.profileStatus): string {
    switch (value) {
      case 'public':
        return 'public';
      case 'friends only':
        return 'groups';
      case 'host only':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  protected getPhysiqueIcon(value: string): string {
    const normalized = this.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'directions_run';
    }
    if (normalized.includes('lean')) {
      return 'self_improvement';
    }
    if (normalized.includes('athletic')) {
      return 'fitness_center';
    }
    if (normalized.includes('fit')) {
      return 'sports_gymnastics';
    }
    if (normalized.includes('curvy')) {
      return 'accessibility';
    }
    if (normalized.includes('muscular')) {
      return 'sports_mma';
    }
    return 'accessibility_new';
  }

  protected getPhysiqueClass(value: string): string {
    const normalized = this.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'physique-slim';
    }
    if (normalized.includes('lean')) {
      return 'physique-lean';
    }
    if (normalized.includes('athletic') || normalized.includes('fit')) {
      return 'physique-athletic';
    }
    if (normalized.includes('curvy')) {
      return 'physique-curvy';
    }
    if (normalized.includes('muscular')) {
      return 'physique-muscular';
    }
    return 'physique-average';
  }

  protected getHoroscopeSymbol(value: string): string {
    switch (value) {
      case 'Aries':
        return '♈';
      case 'Taurus':
        return '♉';
      case 'Gemini':
        return '♊';
      case 'Cancer':
        return '♋';
      case 'Leo':
        return '♌';
      case 'Virgo':
        return '♍';
      case 'Libra':
        return '♎';
      case 'Scorpio':
        return '♏';
      case 'Sagittarius':
        return '♐';
      case 'Capricorn':
        return '♑';
      case 'Aquarius':
        return '♒';
      default:
        return '♓';
    }
  }

  protected getHoroscopeClass(value: string): string {
    return `zodiac-${this.normalizeText(value).replace(/\s+/g, '-')}`;
  }

  protected onHeaderPanelClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openProfileEditor();
  }

  protected onBirthdayChange(value: Date | null): void {
    this.profileForm.birthday = value;
    this.profileForm.horoscope = value ? this.getHoroscopeByDate(value) : '';
  }

  protected toggleLanguagePanel(): void {
    this.showLanguagePanel = !this.showLanguagePanel;
  }

  protected addCustomLanguage(value = this.languageInput): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    if (!this.profileForm.languages.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.profileForm.languages = [...this.profileForm.languages, normalized];
    }
    if (!this.languageSuggestions.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      this.languageSuggestions.push(normalized);
    }
    this.languageInput = '';
  }

  protected selectLanguage(value: string): void {
    this.addCustomLanguage(value);
    this.showLanguagePanel = true;
  }

  protected languageTriggerLabel(): string {
    if (this.profileForm.languages.length === 0) {
      return '';
    }
    if (this.profileForm.languages.length === 1) {
      return this.profileForm.languages[0];
    }
    return `${this.profileForm.languages[0]} +${this.profileForm.languages.length - 1}`;
  }

  protected onLanguageInputFocus(): void {
    this.showLanguagePanel = true;
  }

  protected onLanguagePanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  protected onLanguageInputContainerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.showLanguagePanel = true;
  }

  protected onLanguageInputBlur(): void {
    this.addCustomLanguage();
  }

  protected onLanguageInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.addCustomLanguage();
  }

  protected removeLanguage(value: string): void {
    this.profileForm.languages = this.profileForm.languages.filter(item => item !== value);
  }

  protected get availableLanguageSuggestions(): string[] {
    const query = this.languageInput.trim().toLowerCase();
    return this.languageSuggestions.filter(item => {
      const isSelected = this.profileForm.languages.some(selected => selected.toLowerCase() === item.toLowerCase());
      if (isSelected) {
        return false;
      }
      return query.length === 0 ? true : item.toLowerCase().includes(query);
    });
  }

  protected get availableLanguageDisplaySuggestions(): string[] {
    return this.availableLanguageSuggestions.slice(0, 20);
  }

  protected get availableProfileStatusOptions(): Array<{ value: ProfileStatus; icon: string }> {
    return this.profileStatusOptions.filter(option => option.value !== this.profileForm.profileStatus);
  }

  protected get availablePhysiqueOptions(): string[] {
    return this.physiqueOptions.filter(option => option !== this.profileForm.physique);
  }

  protected getHostTierIcon(hostTier: string): string {
    const normalized = this.normalizeText(hostTier);
    if (normalized.includes('platinum')) {
      return 'diamond';
    }
    if (normalized.includes('gold')) {
      return 'emoji_events';
    }
    if (normalized.includes('silver')) {
      return 'workspace_premium';
    }
    if (normalized.includes('bronze')) {
      return 'military_tech';
    }
    return 'workspace_premium';
  }

  protected getHostTierColorClass(hostTier: string): string {
    const normalized = this.normalizeText(hostTier);
    if (normalized.includes('platinum')) {
      return 'icon-tier-platinum';
    }
    if (normalized.includes('gold')) {
      return 'icon-tier-gold';
    }
    if (normalized.includes('silver')) {
      return 'icon-tier-silver';
    }
    if (normalized.includes('bronze')) {
      return 'icon-tier-bronze';
    }
    return 'icon-tier-default';
  }

  protected getTraitIcon(traitLabel: string): string {
    const normalized = this.normalizeText(traitLabel);
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'palette';
    }
    if (normalized.includes('empat')) {
      return 'favorite';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'verified';
    }
    if (normalized.includes('advent')) {
      return 'hiking';
    }
    if (normalized.includes('think')) {
      return 'psychology';
    }
    if (normalized.includes('social')) {
      return 'groups';
    }
    if (normalized.includes('playful')) {
      return 'sports_esports';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'trending_up';
    }
    return 'auto_awesome';
  }

  protected getTraitColorClass(traitLabel: string): string {
    const normalized = this.normalizeText(traitLabel);
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'icon-trait-creative';
    }
    if (normalized.includes('empat')) {
      return 'icon-trait-empath';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'icon-trait-reliable';
    }
    if (normalized.includes('advent')) {
      return 'icon-trait-adventurer';
    }
    if (normalized.includes('think')) {
      return 'icon-trait-thinker';
    }
    if (normalized.includes('social')) {
      return 'icon-trait-social';
    }
    if (normalized.includes('playful')) {
      return 'icon-trait-playful';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'icon-trait-ambitious';
    }
    return 'icon-trait-default';
  }

  protected getInvitationActionSummary(invitation: InvitationMenuItem): string {
    const text = this.normalizeText(invitation.description);
    if (text.includes('jazz') || text.includes('music')) {
      return 'You were added to music + check-in coordination';
    }
    if (text.includes('padel') || text.includes('pair')) {
      return 'You were placed as a pair candidate for the next phase';
    }
    if (text.includes('photo') || text.includes('studio')) {
      return 'You were assigned to checkpoint and content capture';
    }
    if (text.includes('ski') || text.includes('carpool')) {
      return 'You were added to transport + timing planning';
    }
    return 'You have a pending role/action update for this event';
  }

  protected getChatStarter(item: ChatMenuItem): DemoUser {
    const members = this.getChatMembersById(item.id);
    return members[1] ?? members[0] ?? this.activeUser;
  }

  protected getChatLastSender(item: ChatMenuItem): DemoUser {
    return this.users.find(user => user.id === item.lastSenderId) ?? this.getChatMembersById(item.id)[0] ?? this.activeUser;
  }

  protected getChatVisibleMembers(item: ChatMenuItem, limit = 3): DemoUser[] {
    return this.getChatMembersById(item.id).slice(0, limit);
  }

  protected getChatHiddenMemberCount(item: ChatMenuItem, limit = 3): number {
    const total = this.getChatMembersById(item.id).length;
    return total > limit ? total - limit : 0;
  }

  protected getChatMemberCount(item: ChatMenuItem): number {
    return this.getChatMembersById(item.id).length;
  }

  protected get chatPopupMessages(): ChatPopupMessage[] {
    if (!this.selectedChat) {
      return [];
    }
    const members = this.getChatMembersById(this.selectedChat.id);
    const lastSender = members[0] ?? this.getChatLastSender(this.selectedChat);
    const starter = members[1] ?? members[0] ?? this.activeUser;
    const memberB = members[2] ?? starter;
    const memberC = members[3] ?? memberB;
    const me = this.activeUser;

    const byId = (id: string) => this.users.find(user => user.id === id);
    const toMessage = (id: string, text: string, time: string, readByIds: string[], forceMine = false): ChatPopupMessage => {
      const senderUser = byId(id) ?? starter;
      return {
        id: `${this.selectedChat?.id}-${id}-${time}`,
        sender: senderUser.name,
        senderAvatar: this.toChatReader(senderUser),
        text,
        time,
        mine: forceMine || senderUser.id === me.id,
        readBy: readByIds
          .map(readerId => byId(readerId))
          .filter((reader): reader is DemoUser => Boolean(reader))
          .map(reader => this.toChatReader(reader))
      };
    };

    if (this.selectedChat.id === 'c1') {
      return [
        toMessage(starter.id, 'I opened this room to lock transport before 8 PM.', '08:58', [memberB.id]),
        toMessage(me.id, 'I can handle pickup list and final seat assignments.', '09:03', [starter.id, memberB.id], true),
        toMessage(memberB.id, 'I can do airport run if someone covers downtown.', '09:06', [starter.id, me.id]),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '09:11', [starter.id, me.id, memberB.id])
      ];
    }

    if (this.selectedChat.id === 'c2') {
      return [
        toMessage(starter.id, 'Room is open, we need one more player for the second pair.', '18:32', [memberB.id]),
        toMessage(me.id, 'I can join at 19:00 if court #3 stays available.', '18:37', [starter.id], true),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '18:40', [starter.id, me.id])
      ];
    }

    if (this.selectedChat.id === 'c3') {
      return [
        toMessage(starter.id, 'Host queue reviewed, two pending invites expired.', '10:03', [memberB.id]),
        toMessage(me.id, 'I can re-send only to people with verified attendance.', '10:06', [starter.id], true),
        toMessage(lastSender.id, this.selectedChat.lastMessage, '10:09', [starter.id, me.id])
      ];
    }

    return [
      toMessage(starter.id, 'Opened this room to coordinate tasks quickly.', '09:01', [memberB.id]),
      toMessage(me.id, 'I can cover the checklist and send updates.', '09:05', [starter.id], true),
      toMessage(lastSender.id, this.selectedChat.lastMessage, '09:08', [starter.id, me.id, memberC.id])
    ];
  }

  protected addSupplyType(): void {
    const value = this.newSupplyType.trim();
    if (!value) {
      return;
    }
    if (!this.eventSupplyTypes.some(type => type.toLowerCase() === value.toLowerCase())) {
      this.eventSupplyTypes = [...this.eventSupplyTypes, value];
    }
    this.newSupplyType = '';
  }

  protected openSupplyDetail(subEventId: string, subEventTitle: string, type: string): void {
    this.selectedSupplyContext = { subEventId, subEventTitle, type };
    if (this.stackedPopup !== null || this.activePopup === 'chat') {
      this.stackedPopup = 'supplyDetail';
      return;
    }
    this.activePopup = 'supplyDetail';
  }

  protected getSupplyStat(subEvent: SubEventCard, type: string): string {
    const normalized = type.toLowerCase();
    if (normalized.includes('car')) {
      return subEvent.requirements.cars;
    }
    if (normalized.includes('accommodation')) {
      return subEvent.requirements.accommodation;
    }
    if (normalized.includes('accessor')) {
      return subEvent.requirements.accessories;
    }
    if (normalized.includes('member')) {
      return `${this.eventEditor.members.length} / ${this.eventEditor.mainEvent.capacity}`;
    }
    return '0 / 0';
  }

  protected isSupplyStatIncomplete(subEvent: SubEventCard, type: string): boolean {
    const values = this.getSupplyStat(subEvent, type).split('/');
    if (values.length !== 2) {
      return false;
    }
    const current = Number.parseInt(values[0].trim(), 10);
    const max = Number.parseInt(values[1].trim(), 10);
    if (!Number.isFinite(current) || !Number.isFinite(max)) {
      return false;
    }
    return current < max;
  }

  protected get selectedSupplyItems(): Array<{ label: string; detail: string }> {
    if (!this.selectedSupplyContext) {
      return [];
    }
    const type = this.selectedSupplyContext.type.toLowerCase();
    if (type.includes('car')) {
      return this.eventEditor.cars.map(car => ({ label: car.owner, detail: `${car.route} · seats ${car.seats}` }));
    }
    if (type.includes('accommodation')) {
      return this.eventEditor.accommodations.map(room => ({ label: room.name, detail: `${room.rooms} · ${room.people}` }));
    }
    if (type.includes('accessor')) {
      return this.eventEditor.accessories.map(accessory => ({ label: accessory.item, detail: `required ${accessory.required} · offered ${accessory.offered}` }));
    }
    if (type.includes('member')) {
      return this.eventEditor.members.map(member => ({ label: member.name, detail: member.role }));
    }
    return [{ label: 'Custom supply slot', detail: 'Add items and assign to this sub-event.' }];
  }

  protected selectImageSlot(index: number): void {
    this.selectedImageIndex = index;
    this.openImageUpload(index);
  }

  protected removeImage(index: number): void {
    this.imageSlots[index] = null;
    if (this.selectedImageIndex === index) {
      this.selectedImageIndex = 0;
    }
  }

  protected onImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingUploadPreview = typeof reader.result === 'string' ? reader.result : null;
    };
    reader.readAsDataURL(file);
    target.value = '';
  }

  protected applyUploadedImage(): void {
    if (this.pendingUploadPreview) {
      this.imageSlots[this.uploadTargetIndex] = this.pendingUploadPreview;
      this.selectedImageIndex = this.uploadTargetIndex;
    }
    if (this.stackedPopup !== null) {
      this.stackedPopup = 'imageEditor';
      return;
    }
    this.activePopup = 'imageEditor';
  }

  protected saveProfile(): void {
    const user = this.activeUser;
    user.name = this.profileForm.fullName.trim() || user.name;
    const birthday = this.profileForm.birthday ? this.toIsoDate(this.profileForm.birthday) : user.birthday;
    user.birthday = birthday;
    user.age = this.getAgeFromIsoDate(birthday);
    user.city = this.profileForm.city.trim() || user.city;
    user.height = this.profileForm.heightCm ? `${this.profileForm.heightCm} cm` : user.height;
    user.physique = this.profileForm.physique || user.physique;
    user.languages = this.profileForm.languages.length > 0 ? [...this.profileForm.languages] : user.languages;
    user.horoscope = this.profileForm.horoscope || user.horoscope;
    user.profileStatus = this.profileForm.profileStatus;
    user.about = this.profileForm.about.trim().slice(0, 160);
    user.initials = this.toInitials(user.name);
    this.alertService.open('Profile saved');
  }

  protected get selectedImagePreview(): string | null {
    return this.imageSlots[this.selectedImageIndex] ?? null;
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type: 'eventEditor' | 'eventExplore' }>;
    if (!popupEvent.detail?.type) {
      return;
    }
    if (popupEvent.detail.type === 'eventEditor') {
      this.openEventEditor();
      return;
    }
    this.openEventExplore();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showUserMenu && !target.closest('.user-menu-panel') && !target.closest('.user-selector-btn-global')) {
      this.showUserMenu = false;
    }
    if (this.showLanguagePanel && target.closest('.cdk-overlay-pane')) {
      return;
    }
    if (this.showLanguagePanel && !target.closest('.language-filter')) {
      this.showLanguagePanel = false;
    }
  }

  private getInitialUserId(): string {
    const stored = localStorage.getItem('demo-active-user');
    if (stored && this.users.some(user => user.id === stored)) {
      return stored;
    }
    return this.users[0].id;
  }

  private syncProfileFormFromActiveUser(): void {
    const user = this.activeUser;
    const birthday = this.fromIsoDate(user.birthday);
    this.profileForm = {
      fullName: user.name,
      birthday,
      city: user.city,
      heightCm: Number.parseInt(user.height, 10) || null,
      physique: user.physique,
      languages: [...user.languages],
      horoscope: birthday ? this.getHoroscopeByDate(birthday) : user.horoscope,
      profileStatus: user.profileStatus,
      hostTier: user.hostTier,
      traitLabel: user.traitLabel,
      about: user.about
    };
  }

  protected get profileCardBirthday(): string {
    if (!this.profileForm.birthday) {
      return 'Birthday';
    }
    return this.profileForm.birthday.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected get profileEditorAge(): number {
    if (!this.profileForm.birthday) {
      return this.activeUser.age;
    }
    return this.getAgeFromIsoDate(this.toIsoDate(this.profileForm.birthday));
  }

  private fromIsoDate(value: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getAgeFromIsoDate(value: string): number {
    const birthday = this.fromIsoDate(value);
    if (!birthday) {
      return this.activeUser.age;
    }
    const now = new Date();
    let age = now.getFullYear() - birthday.getFullYear();
    const monthDiff = now.getMonth() - birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) {
      age -= 1;
    }
    return age;
  }

  private getHoroscopeByDate(value: Date): string {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
    return 'Capricorn';
  }

  private toInitials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (!parts.length) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  private getChatMembersById(chatId: string): DemoUser[] {
    const chatItem = this.getChatItemById(chatId);
    const explicitMembers = (chatItem?.memberIds ?? [])
      .map(memberId => this.users.find(user => user.id === memberId))
      .filter((user): user is DemoUser => Boolean(user));
    const lastSender = chatItem?.lastSenderId ? this.users.find(user => user.id === chatItem.lastSenderId) ?? null : null;

    const orderedMembers: DemoUser[] = [];
    if (lastSender) {
      orderedMembers.push(lastSender);
    }
    for (const member of explicitMembers) {
      if (!orderedMembers.some(item => item.id === member.id)) {
        orderedMembers.push(member);
      }
    }
    if (!orderedMembers.some(item => item.id === this.activeUser.id)) {
      orderedMembers.push(this.activeUser);
    }
    if (orderedMembers.length > 0) {
      return orderedMembers;
    }

    const others = this.users.filter(user => user.id !== this.activeUser.id);
    if (!others.length) {
      return [this.activeUser];
    }
    const seed = this.hashText(chatId);
    const offsets = [0, 3, 7, 11, 15, 19];
    const memberCount = 3 + (seed % 3);
    const picked: DemoUser[] = [];
    for (const offset of offsets) {
      const user = others[(seed + offset) % others.length];
      if (!picked.some(item => item.id === user.id)) {
        picked.push(user);
      }
      if (picked.length === memberCount) {
        break;
      }
    }
    while (picked.length < memberCount) {
      picked.push(others[picked.length % others.length]);
    }
    return picked;
  }

  private getChatItemById(chatId: string): ChatMenuItem | undefined {
    for (const entries of Object.values(DEMO_CHAT_BY_USER)) {
      const match = entries.find(item => item.id === chatId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      const chatThread = globalThis.document?.querySelector('.chat-thread');
      if (chatThread instanceof HTMLElement) {
        chatThread.scrollTop = chatThread.scrollHeight;
      }
    }, 0);
  }

  private toChatReader(user: DemoUser): ChatReadAvatar {
    return {
      id: user.id,
      initials: user.initials,
      gender: user.gender
    };
  }

  private hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 104729;
    }
    return Math.abs(hash);
  }

  private resolveSectionBadge(values: number[], itemCount: number): number {
    const positiveTotal = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
    if (positiveTotal > 0) {
      return positiveTotal;
    }
    return itemCount;
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
