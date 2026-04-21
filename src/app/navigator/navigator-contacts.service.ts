import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AppUtils } from '../shared/app-utils';
import {
  AppContext,
  AppPopupContext,
  SessionService,
  UsersService,
  type ActivityMemberEntry,
  type UserDto
} from '../shared/core';
import type { ListQuery, PageResult } from '../shared/ui';

export type NavigatorContactMethodType =
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'linkedin'
  | 'website';

export interface NavigatorContactMethodOption {
  value: NavigatorContactMethodType;
  label: string;
  icon: string;
  placeholder: string;
  helpText: string;
  inputType: 'text' | 'tel' | 'email' | 'url';
  inputMode: 'text' | 'tel' | 'email' | 'url';
  autocomplete: string;
  actionLabel: string;
  openBehavior: 'same-tab' | 'new-tab';
}

export interface NavigatorContactMethodDraft {
  id: string;
  type: NavigatorContactMethodType;
  value: string;
}

export interface NavigatorStoredContact {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  createdAtIso: string;
  updatedAtIso: string;
  methods: NavigatorContactMethodDraft[];
}

export interface NavigatorContactMethodItem extends NavigatorContactMethodDraft {
  label: string;
  icon: string;
  displayValue: string;
  menuLabel: string;
  href: string;
  openBehavior: 'same-tab' | 'new-tab';
}

export interface NavigatorContactListItem {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  groupLabel: string;
  methodCount: number;
  methodCountLabel: string;
  methods: NavigatorContactMethodItem[];
  updatedAtIso: string;
  searchText: string;
}

export interface NavigatorContactFormValue {
  id: string;
  userId: string;
  name: string;
  initials: string;
  gender: UserDto['gender'];
  city: string;
  avatarUrl: string;
  headline: string;
  methods: NavigatorContactMethodDraft[];
}

export interface NavigatorContactListFilters {
  search?: string;
  refreshToken?: number;
}

export const NAVIGATOR_CONTACT_METHOD_OPTIONS: readonly NavigatorContactMethodOption[] = [
  {
    value: 'phone',
    label: 'Phone',
    icon: 'call',
    placeholder: '+421 900 123 456',
    helpText: 'Opens the phone app on mobile or the default calling handler.',
    inputType: 'tel',
    inputMode: 'tel',
    autocomplete: 'tel',
    actionLabel: 'Call',
    openBehavior: 'same-tab'
  },
  {
    value: 'sms',
    label: 'SMS',
    icon: 'sms',
    placeholder: '+421 900 123 456',
    helpText: 'Starts a text message with the number filled in.',
    inputType: 'tel',
    inputMode: 'tel',
    autocomplete: 'tel',
    actionLabel: 'Text',
    openBehavior: 'same-tab'
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    icon: 'chat',
    placeholder: '+421900123456',
    helpText: 'Uses the WhatsApp deep link when available.',
    inputType: 'tel',
    inputMode: 'tel',
    autocomplete: 'tel',
    actionLabel: 'Open WhatsApp',
    openBehavior: 'new-tab'
  },
  {
    value: 'email',
    label: 'Email',
    icon: 'mail',
    placeholder: 'hello@example.com',
    helpText: 'Opens the default mail app with the address ready.',
    inputType: 'email',
    inputMode: 'email',
    autocomplete: 'email',
    actionLabel: 'Email',
    openBehavior: 'same-tab'
  },
  {
    value: 'facebook',
    label: 'Facebook',
    icon: 'thumb_up',
    placeholder: '@username or https://facebook.com/username',
    helpText: 'Opens the Facebook profile in the app or a browser tab.',
    inputType: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    actionLabel: 'Open Facebook',
    openBehavior: 'new-tab'
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: 'photo_camera',
    placeholder: '@username or https://instagram.com/username',
    helpText: 'Opens the Instagram profile.',
    inputType: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    actionLabel: 'Open Instagram',
    openBehavior: 'new-tab'
  },
  {
    value: 'telegram',
    label: 'Telegram',
    icon: 'send',
    placeholder: '@username or https://t.me/username',
    helpText: 'Opens the Telegram contact.',
    inputType: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    actionLabel: 'Open Telegram',
    openBehavior: 'new-tab'
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: 'work',
    placeholder: 'username or https://linkedin.com/in/username',
    helpText: 'Opens the LinkedIn profile.',
    inputType: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    actionLabel: 'Open LinkedIn',
    openBehavior: 'new-tab'
  },
  {
    value: 'website',
    label: 'Website',
    icon: 'language',
    placeholder: 'https://example.com',
    helpText: 'Opens any profile, portfolio, or custom contact URL.',
    inputType: 'url',
    inputMode: 'url',
    autocomplete: 'url',
    actionLabel: 'Open Link',
    openBehavior: 'new-tab'
  }
];

const STORAGE_KEY_PREFIX = 'myscoutee.navigator.contacts.v1';
const CONTACT_METHOD_OPTION_BY_TYPE = new Map(
  NAVIGATOR_CONTACT_METHOD_OPTIONS.map(option => [option.value, option])
);

@Injectable({
  providedIn: 'root'
})
export class NavigatorContactsService {
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly sessionService = inject(SessionService);
  private readonly usersService = inject(UsersService);

  private readonly openRef = signal(false);
  private readonly contactsRef = signal<NavigatorStoredContact[]>([]);
  private readonly revisionRef = signal(0);
  private readonly lastOptimisticRevisionRef = signal(0);
  private readonly contactCountRef = signal(0);
  private warmedUserIds = new Set<string>();
  private loadedUserId = '';

  readonly isOpen = this.openRef.asReadonly();
  readonly revision = this.revisionRef.asReadonly();
  readonly lastOptimisticRevision = this.lastOptimisticRevisionRef.asReadonly();
  readonly contactCount = this.contactCountRef.asReadonly();
  readonly contacts = computed(() => this.contactsRef().map(contact => this.toListItem(contact)));

  constructor() {
    effect(() => {
      const activeUserId = this.appCtx.activeUserId().trim();
      const previousLoadedUserId = this.loadedUserId;
      if (activeUserId === this.loadedUserId) {
        return;
      }
      this.loadedUserId = activeUserId;
      this.warmedUserIds = new Set<string>();
      this.migrateHttpAliasContacts(previousLoadedUserId, activeUserId);
      this.contactsRef.set(this.readContacts(activeUserId));
      this.contactCountRef.set(this.contactsRef().length);
      this.bumpRevision(false);
      if (!activeUserId) {
        this.openRef.set(false);
      }
    });
  }

  openPopup(): void {
    if (!this.activeUserId()) {
      return;
    }
    this.openRef.set(true);
  }

  closePopup(): void {
    this.openRef.set(false);
  }

  summaryLabel(): string {
    const count = this.contactCountRef();
    if (count === 1) {
      return '1 saved contact';
    }
    return `${count} saved contacts`;
  }

  async openCreateContactPicker(): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    await this.ensureKnownUsersWarm();

    this.popupCtx.openActivityInvitePopup({
      ownerId: activeUserId,
      ownerType: 'asset',
      title: 'Create contact',
      onApply: async selectedCandidates => {
        await this.addContacts(selectedCandidates);
      }
    });
  }

  async loadContactPage(
    query: ListQuery<NavigatorContactListFilters>
  ): Promise<PageResult<NavigatorContactListItem>> {
    await this.ensureKnownUsersWarm();
    const search = AppUtils.normalizeText(query.filters?.search ?? '');
    const contacts = this.contacts()
      .filter(contact => !search || contact.searchText.includes(search))
      .sort((left, right) => this.compareContacts(left, right));
    const pageSize = Math.max(1, Number(query.pageSize) || 24);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: contacts.slice(startIndex, startIndex + pageSize),
      total: contacts.length
    };
  }

  createFormValue(contact: NavigatorContactListItem): NavigatorContactFormValue {
    return {
      id: contact.id,
      userId: contact.userId,
      name: contact.name,
      initials: contact.initials,
      gender: contact.gender,
      city: contact.city,
      avatarUrl: contact.avatarUrl,
      headline: contact.headline,
      methods: contact.methods.map(method => ({
        id: method.id,
        type: method.type,
        value: method.value
      }))
    };
  }

  createEmptyMethodDraft(type: NavigatorContactMethodType = 'phone'): NavigatorContactMethodDraft {
    return {
      id: this.randomId('method'),
      type,
      value: ''
    };
  }

  async saveContact(form: NavigatorContactFormValue): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    const normalizedContactId = form.id.trim();
    const existing = this.contactsRef().find(contact => contact.id === normalizedContactId);
    const user = this.usersService.peekCachedUserById(form.userId) ?? null;
    const nowIso = new Date().toISOString();
    const nextContact = this.normalizeStoredContact({
      id: normalizedContactId || form.userId.trim() || this.randomId('contact'),
      userId: form.userId.trim(),
      name: user?.name ?? form.name,
      initials: user?.initials ?? form.initials,
      gender: user?.gender ?? form.gender,
      city: user?.city ?? form.city,
      avatarUrl: this.resolveUserAvatarUrl(user) || form.avatarUrl,
      headline: user?.headline ?? form.headline,
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      methods: form.methods
    });
    const nextContacts = this.contactsRef()
      .filter(contact => contact.id !== nextContact.id)
      .concat(nextContact);
    this.persistContacts(activeUserId, nextContacts);
    this.bumpRevision(true);
  }

  async deleteContact(contactId: string): Promise<void> {
    const activeUserId = this.activeUserId();
    const normalizedContactId = contactId.trim();
    if (!activeUserId || !normalizedContactId) {
      return;
    }
    const nextContacts = this.contactsRef().filter(contact => contact.id !== normalizedContactId);
    this.persistContacts(activeUserId, nextContacts);
    this.bumpRevision(true);
  }

  triggerMethod(method: NavigatorContactMethodItem): void {
    const href = method.href.trim();
    if (!href || typeof window === 'undefined') {
      return;
    }
    if (method.openBehavior === 'new-tab') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = href;
  }

  methodOption(type: NavigatorContactMethodType): NavigatorContactMethodOption {
    return CONTACT_METHOD_OPTION_BY_TYPE.get(type) ?? NAVIGATOR_CONTACT_METHOD_OPTIONS[0];
  }

  private async addContacts(selectedCandidates: readonly ActivityMemberEntry[]): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId || selectedCandidates.length === 0) {
      return;
    }
    await this.usersService.warmCachedUsers(selectedCandidates.map(candidate => candidate.userId));
    const nextById = new Map(this.contactsRef().map(contact => [contact.id, contact]));
    const nowIso = new Date().toISOString();
    for (const candidate of selectedCandidates) {
      const normalizedUserId = candidate.userId.trim();
      if (!normalizedUserId) {
        continue;
      }
      const existing = nextById.get(normalizedUserId);
      const user = this.usersService.peekCachedUserById(normalizedUserId);
      nextById.set(normalizedUserId, this.normalizeStoredContact({
        id: normalizedUserId,
        userId: normalizedUserId,
        name: user?.name ?? candidate.name,
        initials: user?.initials ?? candidate.initials,
        gender: user?.gender ?? candidate.gender,
        city: user?.city ?? candidate.city,
        avatarUrl: this.resolveUserAvatarUrl(user) || candidate.avatarUrl,
        headline: user?.headline ?? user?.statusText ?? existing?.headline ?? '',
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
        methods: existing?.methods ?? []
      }));
    }
    this.persistContacts(activeUserId, [...nextById.values()]);
    this.bumpRevision(true);
  }

  allContactsAsMemberEntries(): ActivityMemberEntry[] {
    return this.contactsRef().map(contact => this.toMemberEntry(contact));
  }

  private toMemberEntry(contact: NavigatorStoredContact): ActivityMemberEntry {
    return {
      id: contact.id,
      userId: contact.userId,
      name: contact.name,
      initials: contact.initials,
      gender: contact.gender === 'woman' ? 'woman' : 'man',
      city: contact.city,
      statusText: contact.headline,
      role: 'Member',
      status: 'accepted',
      pendingSource: null,
      requestKind: null,
      invitedByActiveUser: true,
      metAtIso: contact.createdAtIso,
      actionAtIso: contact.updatedAtIso,
      metWhere: '',
      relevance: 100,
      avatarUrl: contact.avatarUrl
    };
  }

  private toListItem(contact: NavigatorStoredContact): NavigatorContactListItem {
    const user = this.usersService.peekCachedUserById(contact.userId);
    const name = `${user?.name ?? contact.name}`.trim() || 'Contact';
    const initials = `${user?.initials ?? contact.initials}`.trim() || AppUtils.initialsFromText(name);
    const city = `${user?.city ?? contact.city}`.trim();
    const headline = `${user?.headline ?? contact.headline ?? user?.statusText ?? ''}`.trim();
    const avatarUrl = this.resolveUserAvatarUrl(user) || contact.avatarUrl;
    const methods = contact.methods
      .map(method => this.toMethodItem(method))
      .filter((method): method is NavigatorContactMethodItem => Boolean(method.href));
    const methodCount = methods.length;
    const searchText = AppUtils.normalizeText([
      name,
      city,
      headline,
      ...methods.map(method => method.displayValue),
      ...methods.map(method => method.label)
    ].filter(Boolean).join(' '));
    return {
      id: contact.id,
      userId: contact.userId,
      name,
      initials,
      gender: user?.gender ?? contact.gender,
      city,
      avatarUrl,
      headline,
      groupLabel: this.groupLabel(name),
      methodCount,
      methodCountLabel: methodCount === 1 ? '1 route' : `${methodCount} routes`,
      methods,
      updatedAtIso: contact.updatedAtIso,
      searchText
    };
  }

  private toMethodItem(method: NavigatorContactMethodDraft): NavigatorContactMethodItem {
    const option = this.methodOption(method.type);
    const value = method.value.trim();
    const href = this.resolveMethodHref(method.type, value);
    const displayValue = this.resolveMethodDisplayValue(method.type, value);
    return {
      ...method,
      label: option.label,
      icon: option.icon,
      displayValue,
      menuLabel: displayValue || option.label,
      href,
      openBehavior: option.openBehavior
    };
  }

  private resolveMethodHref(type: NavigatorContactMethodType, value: string): string {
    if (!value) {
      return '';
    }
    if (type === 'phone') {
      const phone = this.normalizePhoneUriValue(value);
      return phone ? `tel:${phone}` : '';
    }
    if (type === 'sms') {
      const phone = this.normalizePhoneUriValue(value);
      return phone ? `sms:${phone}` : '';
    }
    if (type === 'whatsapp') {
      if (this.isAbsoluteUrl(value)) {
        return value;
      }
      const digits = this.normalizePhoneDigits(value);
      return digits ? `https://wa.me/${digits}` : '';
    }
    if (type === 'email') {
      const email = value.replace(/^mailto:/i, '').trim();
      return email ? `mailto:${email}` : '';
    }
    if (type === 'facebook') {
      return this.socialHref(value, 'facebook.com/');
    }
    if (type === 'instagram') {
      return this.socialHref(value, 'instagram.com/');
    }
    if (type === 'telegram') {
      return this.socialHref(value, 't.me/');
    }
    if (type === 'linkedin') {
      return this.socialHref(value, 'linkedin.com/in/');
    }
    return this.websiteHref(value);
  }

  private resolveMethodDisplayValue(type: NavigatorContactMethodType, value: string): string {
    if (!value) {
      return '';
    }
    if (type === 'phone' || type === 'sms' || type === 'whatsapp') {
      return value;
    }
    if (type === 'email') {
      return value.replace(/^mailto:/i, '').trim();
    }
    if (type === 'website') {
      return value.replace(/^https?:\/\//i, '').trim();
    }
    const cleaned = value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/^[^/]+\//, '')
      .replace(/^@/, '')
      .trim();
    return cleaned ? `@${cleaned}` : value;
  }

  private socialHref(value: string, domainPath: string): string {
    if (this.isAbsoluteUrl(value)) {
      return value;
    }
    const cleaned = value
      .replace(/^@/, '')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/^[^/]+\//, '')
      .trim();
    return cleaned ? `https://${domainPath}${cleaned}` : '';
  }

  private websiteHref(value: string): string {
    if (!value) {
      return '';
    }
    if (this.isAbsoluteUrl(value)) {
      return value;
    }
    return `https://${value.trim()}`;
  }

  private isAbsoluteUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
  }

  private normalizePhoneUriValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const hasPlusPrefix = trimmed.startsWith('+');
    const digits = trimmed.replace(/[^\d]/g, '');
    if (!digits) {
      return '';
    }
    return `${hasPlusPrefix ? '+' : ''}${digits}`;
  }

  private normalizePhoneDigits(value: string): string {
    return value.replace(/[^\d]/g, '').trim();
  }

  private normalizeStoredContact(contact: Partial<NavigatorStoredContact>): NavigatorStoredContact {
    const name = `${contact.name ?? ''}`.trim() || 'Contact';
    const userId = `${contact.userId ?? ''}`.trim();
    const id = `${contact.id ?? ''}`.trim() || userId || this.randomId('contact');
    const gender = contact.gender === 'woman' ? 'woman' : 'man';
    const methods = (contact.methods ?? [])
      .map(method => this.normalizeMethodDraft(method))
      .filter((method): method is NavigatorContactMethodDraft => Boolean(method && method.value));
    return {
      id,
      userId,
      name,
      initials: `${contact.initials ?? ''}`.trim() || AppUtils.initialsFromText(name),
      gender,
      city: `${contact.city ?? ''}`.trim(),
      avatarUrl: `${contact.avatarUrl ?? ''}`.trim(),
      headline: `${contact.headline ?? ''}`.trim(),
      createdAtIso: `${contact.createdAtIso ?? ''}`.trim() || new Date().toISOString(),
      updatedAtIso: `${contact.updatedAtIso ?? ''}`.trim() || new Date().toISOString(),
      methods
    };
  }

  private normalizeMethodDraft(method: Partial<NavigatorContactMethodDraft> | null | undefined): NavigatorContactMethodDraft | null {
    if (!method) {
      return null;
    }
    const type = CONTACT_METHOD_OPTION_BY_TYPE.has(method.type as NavigatorContactMethodType)
      ? method.type as NavigatorContactMethodType
      : 'phone';
    const value = `${method.value ?? ''}`.trim();
    if (!value) {
      return null;
    }
    return {
      id: `${method.id ?? ''}`.trim() || this.randomId('method'),
      type,
      value
    };
  }

  private readContacts(userId: string): NavigatorStoredContact[] {
    if (!userId || typeof window === 'undefined') {
      return [];
    }
    try {
      const rawValue = window.localStorage.getItem(this.storageKey(userId));
      if (!rawValue) {
        return [];
      }
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(contact => this.normalizeStoredContact(contact))
        .filter(contact => contact.userId || contact.id);
    } catch {
      return [];
    }
  }

  private persistContacts(userId: string, contacts: NavigatorStoredContact[]): void {
    const normalizedContacts = contacts
      .map(contact => this.normalizeStoredContact(contact))
      .sort((left, right) => this.compareContacts(this.toListItem(left), this.toListItem(right)));
    this.contactsRef.set(normalizedContacts);
    this.contactCountRef.set(normalizedContacts.length);
    this.bumpRevision();
    if (typeof window === 'undefined' || !userId) {
      return;
    }
    window.localStorage.setItem(this.storageKey(userId), JSON.stringify(normalizedContacts));
  }

  private migrateHttpAliasContacts(previousUserId: string, nextUserId: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    const normalizedPreviousUserId = previousUserId.trim();
    const normalizedNextUserId = nextUserId.trim();
    if (!normalizedPreviousUserId || !normalizedNextUserId || normalizedPreviousUserId === normalizedNextUserId) {
      return;
    }

    const currentSession = this.sessionService.currentSession();
    if (currentSession?.kind !== 'demo' || currentSession.userId.trim() !== normalizedPreviousUserId) {
      return;
    }

    const previousContacts = this.readContacts(normalizedPreviousUserId);
    if (previousContacts.length === 0) {
      return;
    }

    const mergedContactsById = new Map<string, NavigatorStoredContact>();
    for (const contact of this.readContacts(normalizedNextUserId)) {
      mergedContactsById.set(contact.id, contact);
    }
    for (const contact of previousContacts) {
      const existing = mergedContactsById.get(contact.id);
      if (!existing || contact.updatedAtIso.localeCompare(existing.updatedAtIso) > 0) {
        mergedContactsById.set(contact.id, contact);
      }
    }

    const mergedContacts = [...mergedContactsById.values()];
    window.localStorage.setItem(this.storageKey(normalizedNextUserId), JSON.stringify(mergedContacts));
    window.localStorage.removeItem(this.storageKey(normalizedPreviousUserId));
  }

  private compareContacts(left: Pick<NavigatorContactListItem, 'name' | 'city' | 'updatedAtIso'>, right: Pick<NavigatorContactListItem, 'name' | 'city' | 'updatedAtIso'>): number {
    const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    if (nameCompare !== 0) {
      return nameCompare;
    }
    const cityCompare = left.city.localeCompare(right.city, undefined, { sensitivity: 'base' });
    if (cityCompare !== 0) {
      return cityCompare;
    }
    return right.updatedAtIso.localeCompare(left.updatedAtIso);
  }

  private groupLabel(name: string): string {
    const firstLetter = AppUtils.normalizeText(name).charAt(0).toUpperCase();
    return /^[A-Z]$/.test(firstLetter) ? firstLetter : '#';
  }

  private storageKey(userId: string): string {
    return `${STORAGE_KEY_PREFIX}.${userId}`;
  }

  private resolveUserAvatarUrl(user: UserDto | null | undefined): string {
    return AppUtils.firstImageUrl(user?.images);
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
  }

  private async ensureKnownUsersWarm(): Promise<void> {
    const pendingUserIds = this.contactsRef()
      .map(contact => contact.userId.trim())
      .filter(Boolean)
      .filter(userId => !this.warmedUserIds.has(userId));
    if (pendingUserIds.length === 0) {
      return;
    }
    await this.usersService.warmCachedUsers(pendingUserIds);
    for (const userId of pendingUserIds) {
      this.warmedUserIds.add(userId);
    }
  }

  private randomId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private bumpRevision(optimistic = false): void {
    this.revisionRef.update(value => value + 1);
    if (optimistic) {
      this.lastOptimisticRevisionRef.set(this.revisionRef());
    }
  }
}
