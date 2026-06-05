import { Component, HostListener, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppUtils } from '../../../shared/app-utils';
import {
  ProgressIndicatorComponent,
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import {
  AppContext,
  AppPopupContext,
  ContactsService as ContactsDataService,
  ExplanationGuideService,
  UsersService,
  type ActivityMemberEntry,
  type ContactFormValue,
  type ContactListFilters,
  type ContactListItem,
  type ContactMethodDraft,
  type ContactMethodItem,
  type ContactMethodOption,
  type ContactMethodType,
  type StoredContact,
  type UserDto
} from '../../../shared/core';
import { NavigatorService } from '../../navigator.service';

const CONTACT_METHOD_OPTIONS: readonly ContactMethodOption[] = [
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

const CONTACT_METHOD_OPTION_BY_TYPE = new Map(
  CONTACT_METHOD_OPTIONS.map(option => [option.value, option])
);

@Component({
  selector: 'app-contacts-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    ProgressIndicatorComponent,
    SmartListComponent
  ],
  templateUrl: './contacts-popup.component.html',
  styleUrl: './contacts-popup.component.scss'
})
export class ContactsPopupComponent implements OnDestroy {
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly contactsDataService = inject(ContactsDataService);
  protected readonly contactsPopupOpen = this.navigatorService.contactsPopupOpen;
  protected readonly contactMethodOptions = CONTACT_METHOD_OPTIONS;
  protected readonly isMobileViewport = signal(this.detectMobileViewport());
  protected readonly searchText = signal('');
  protected readonly openActionMenu = signal<{ id: string; openUp: boolean } | null>(null);
  protected readonly editingContact = signal<ContactFormValue | null>(null);
  protected readonly isFormSavePending = signal(false);
  protected readonly formErrorMessage = signal('');
  protected readonly contactSmartListQuery = computed<Partial<ListQuery<ContactListFilters>>>(() => ({
    filters: {
      search: this.searchText(),
      refreshToken: this.manualRefreshRevision()
    }
  }));

  private readonly manualRefreshRevision = signal(0);
  private readonly contactsRef = signal<StoredContact[]>([]);
  private readonly revisionRef = signal(0);
  private readonly lastOptimisticRevisionRef = signal(0);
  private readonly contactCountRef = signal(0);
  private lastKnownTotal = 0;
  private readonly hasInitialLoadCompleted = signal(false);
  private contactsExplanationContextKey: string | null = null;
  private unregisterContactsExplanationContext: (() => void) | null = null;
  private loadedUserId = '';
  private contactsLoadedForUserId = '';
  private contactsLoadPromise: Promise<void> | null = null;
  private contactLoadToken = 0;

  constructor() {
    effect(() => {
      const activeUserId = this.activeUserId();
      if (activeUserId === this.loadedUserId) {
        return;
      }
      this.loadedUserId = activeUserId;
      this.contactsLoadedForUserId = '';
      this.contactsLoadPromise = null;
      this.contactLoadToken += 1;
      this.applyContacts([], false);
    });

    effect(() => {
      this.setContactsExplanationContext(this.navigatorService.contactsPopupOpen() ? 'contacts' : null);
    });

    effect(() => {
      const revision = this.revisionRef();
      const lastOptimistic = this.lastOptimisticRevisionRef();
      untracked(() => {
        const currentTotal = this.contactCountRef();
        if (revision && revision === lastOptimistic) {
          if (this.contactsSmartList) {
            const additions = Math.max(0, currentTotal - this.lastKnownTotal);
            const loadedCount = this.contactsSmartList.itemsSnapshot().length;
            this.contactsSmartList.replaceVisibleItems(this.contactListItems().slice(0, loadedCount + additions), {
              total: currentTotal
            });
          }
          this.lastKnownTotal = currentTotal;
          return;
        }
        this.lastKnownTotal = currentTotal;
        this.manualRefreshRevision.set(revision);
      });
    });
  }

  ngOnDestroy(): void {
    this.clearContactsExplanationContext();
  }

  @ViewChild('contactsSmartList')
  private contactsSmartList?: SmartListComponent<ContactListItem, ContactListFilters>;

  protected readonly contactSmartListLoadPage: SmartListLoadPage<ContactListItem, ContactListFilters> = (query) =>
    from(this.loadContactPage(query)).pipe(
      tap(() => {
        if (!this.hasInitialLoadCompleted()) {
          this.hasInitialLoadCompleted.set(true);
        }
      })
    );

  protected readonly contactSmartListConfig = computed<SmartListConfig<ContactListItem, ContactListFilters>>(() => ({
    pageSize: 10,
    defaultView: 'list',
    emptyLabel: 'No contacts saved yet',
    emptyDescription: 'Use Create contact to add members into your personal quick-reach list.',
    emptyStickyLabel: 'No contacts',
    headerProgress: {
      enabled: true
    },
    showStickyHeader: true,
    stickyHeaderClass: 'activities-sticky-header',
    listLayout: 'stack',
    snapMode: 'mandatory',
    initialScrollAnchor: 'first-item',
    scrollPaddingTop: '2.8rem',
    containerClass: {
      'contacts-scroll-list': true
    },
    trackBy: (_index, contact) => contact.id,
    showGroupMarker: ({ groupIndex, scrollable }) => groupIndex > 0 || scrollable,
    groupBy: contact => contact.groupLabel,
    onDelete: (contact: ContactListItem, event?: Event) => this.confirmDelete(contact, event)
  }));

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.navigatorService.contactsPopupOpen() || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.editingContact()) {
      this.closeFormPopup();
      return;
    }
    if (this.openActionMenu()) {
      this.closeActionMenu();
      return;
    }
    this.closePopup();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.isMobileViewport.set(this.detectMobileViewport());
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.openActionMenu()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('.contact-menu-anchor')) {
      return;
    }
    this.closeActionMenu();
  }

  protected closePopup(event?: Event): void {
    event?.stopPropagation();
    if (this.isFormSavePending()) {
      return;
    }
    this.closeActionMenu();
    this.searchText.set('');
    this.editingContact.set(null);
    this.formErrorMessage.set('');
    this.navigatorService.closeContactsPopup();
  }

  private setContactsExplanationContext(contextKey: string | null): void {
    if (this.contactsExplanationContextKey === contextKey) {
      return;
    }
    this.clearContactsExplanationContext();
    if (!contextKey) {
      return;
    }
    this.contactsExplanationContextKey = contextKey;
    this.unregisterContactsExplanationContext = this.explanationGuide.registerContext(contextKey);
  }

  private clearContactsExplanationContext(): void {
    this.unregisterContactsExplanationContext?.();
    this.unregisterContactsExplanationContext = null;
    this.contactsExplanationContextKey = null;
  }

  protected async openCreateContactPicker(event?: Event): Promise<void> {
    event?.stopPropagation();
    this.closeActionMenu();
    
    await this.openCreateContactPickerFromMembers();
  }

  protected toggleActionMenu(contact: ContactListItem, event: Event): void {
    event.stopPropagation();
    const openActionMenu = this.openActionMenu();
    if (openActionMenu?.id === contact.id) {
      this.openActionMenu.set(null);
      return;
    }
    this.openActionMenu.set({
      id: contact.id,
      openUp: this.shouldOpenInlineMenuUp(event)
    });
  }

  protected isActionMenuOpen(contact: ContactListItem): boolean {
    return this.openActionMenu()?.id === contact.id;
  }

  protected isActionMenuOpenUp(contact: ContactListItem): boolean {
    const menu = this.openActionMenu();
    return menu?.id === contact.id && menu.openUp;
  }

  protected clearSearch(event?: Event): void {
    event?.stopPropagation();
    this.searchText.set('');
  }

  protected openEditForm(contact: ContactListItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.formErrorMessage.set('');
    this.editingContact.set(this.createFormValue(contact));
  }

  protected viewContactProfile(contact: ContactListItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeActionMenu();
    const userId = `${contact.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    const user = this.usersService.peekCachedUserById(userId);
    this.navigatorService.openProfileView({
      userId,
      user,
      label: contact.name
    });
  }

  protected closeFormPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.isFormSavePending()) {
      return;
    }
    this.formErrorMessage.set('');
    this.editingContact.set(null);
  }

  protected addMethodRow(event?: Event): void {
    event?.stopPropagation();
    const contact = this.editingContact();
    if (!contact) {
      return;
    }
    this.editingContact.set({
      ...contact,
      methods: [...contact.methods, this.createEmptyMethodDraft()]
    });
  }

  protected removeMethodRow(methodId: string, event?: Event): void {
    event?.stopPropagation();
    const contact = this.editingContact();
    if (!contact) {
      return;
    }
    this.editingContact.set({
      ...contact,
      methods: contact.methods.filter(method => method.id !== methodId)
    });
  }

  protected updateMethodType(methodId: string, type: ContactMethodType): void {
    const contact = this.editingContact();
    if (!contact) {
      return;
    }
    this.editingContact.set({
      ...contact,
      methods: contact.methods.map(method => method.id === methodId ? { ...method, type, value: '' } : method)
    });
  }

  protected async saveForm(event?: Event): Promise<void> {
    event?.stopPropagation();
    const contact = this.editingContact();
    if (!contact || this.isFormSavePending()) {
      return;
    }
    this.isFormSavePending.set(true);
    this.formErrorMessage.set('');
    try {
      await this.saveContact(contact);
      this.isFormSavePending.set(false);
      this.editingContact.set(null);
    } catch (error) {
      this.isFormSavePending.set(false);
      this.formErrorMessage.set(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Unable to save this contact right now.'
      );
    }
  }

  protected confirmDelete(contact: ContactListItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.confirmationDialogService.open({
      title: `Delete ${contact.name}?`,
      message: 'This removes the contact and all saved availability methods from your local list.',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Unable to delete this contact right now.',
      onConfirm: async () => {
        // Optimistically remove from the visible list
        if (this.contactsSmartList) {
          const current = this.contactsSmartList.itemsSnapshot();
          this.contactsSmartList.replaceVisibleItems(current.filter(i => i.id !== contact.id), {
            total: Math.max(0, (this.contactsSmartList.totalItemCount() ?? current.length) - 1)
          });
        }
        
        // Update lastKnownTotal so the effect knows we already accounted for this deletion
        this.lastKnownTotal = Math.max(0, this.lastKnownTotal - 1);

        await this.deleteContact(contact.id);
      }
    });
  }

  protected runMethod(method: ContactMethodItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.triggerMethod(method);
  }

  protected methodOption(type: ContactMethodType) {
    return this.lookupMethodOption(type);
  }

  protected methodToneClass(type: ContactMethodType): string {
    return `contact-method-tone-${type}`;
  }

  protected methodPanelClasses(type: ContactMethodType): string[] {
    return [
      'selector-options-panel',
      'profile-bottom-sheet-panel',
      'contact-method-panel',
      this.methodToneClass(type)
    ];
  }

  protected trackMethod(_index: number, method: ContactMethodDraft): string {
    return `${method.id}:${method.type}`;
  }

  protected visibleMethodChips(contact: ContactListItem): ContactMethodItem[] {
    return contact.methods.slice(0, 4);
  }

  protected hiddenMethodCount(contact: ContactListItem): number {
    return Math.max(0, contact.methods.length - 4);
  }

  protected summaryLabel(): string {
    const count = this.contactCountRef();
    return count === 1 ? '1 saved contact' : `${count} saved contacts`;
  }

  private async openCreateContactPickerFromMembers(): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }

    this.popupCtx.openActivityInvitePopup({
      ownerId: activeUserId,
      ownerType: 'asset',
      title: 'Create contact',
      onApply: async selectedCandidates => {
        await this.addContacts(selectedCandidates);
      }
    });
  }

  private async loadContactPage(
    query: ListQuery<ContactListFilters>
  ): Promise<PageResult<ContactListItem>> {
    await this.ensureContactsLoadedForActiveUser();
    const search = AppUtils.normalizeText(query.filters?.search ?? '');
    const contacts = this.contactListItems()
      .filter(contact => !search || contact.searchText.includes(search))
      .sort((left, right) => this.compareContacts(left, right));
    const pageSize = Math.max(1, Number(query.pageSize) || 24);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: contacts.slice(startIndex, startIndex + pageSize),
      total: contacts.length
    };
  }

  private contactListItems(): ContactListItem[] {
    return this.contactsRef().map(contact => this.toListItem(contact));
  }

  private createFormValue(contact: ContactListItem): ContactFormValue {
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

  private createEmptyMethodDraft(type: ContactMethodType = 'phone'): ContactMethodDraft {
    return {
      id: this.randomId('method'),
      type,
      value: ''
    };
  }

  private async saveContact(form: ContactFormValue): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    await this.ensureContactsLoadedForActiveUser();
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
    const savedContacts = await this.contactsDataService.saveContacts(activeUserId, this.normalizeContacts(nextContacts));
    this.contactsLoadedForUserId = activeUserId;
    this.applyContacts(savedContacts, true);
  }

  private async deleteContact(contactId: string): Promise<void> {
    const activeUserId = this.activeUserId();
    const normalizedContactId = contactId.trim();
    if (!activeUserId || !normalizedContactId) {
      return;
    }
    await this.ensureContactsLoadedForActiveUser();
    const savedContacts = await this.contactsDataService.deleteContact(activeUserId, normalizedContactId);
    this.contactsLoadedForUserId = activeUserId;
    this.applyContacts(savedContacts, true);
  }

  private triggerMethod(method: ContactMethodItem): void {
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

  private lookupMethodOption(type: ContactMethodType): ContactMethodOption {
    return CONTACT_METHOD_OPTION_BY_TYPE.get(type) ?? CONTACT_METHOD_OPTIONS[0];
  }

  private async addContacts(selectedCandidates: readonly ActivityMemberEntry[]): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId || selectedCandidates.length === 0) {
      return;
    }
    await this.ensureContactsLoadedForActiveUser();
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
    const savedContacts = await this.contactsDataService.saveContacts(activeUserId, this.normalizeContacts([...nextById.values()]));
    this.contactsLoadedForUserId = activeUserId;
    this.applyContacts(savedContacts, true);
  }

  private toListItem(contact: StoredContact): ContactListItem {
    const user = this.usersService.peekCachedUserById(contact.userId);
    const name = `${user?.name ?? contact.name}`.trim() || 'Contact';
    const initials = `${user?.initials ?? contact.initials}`.trim() || AppUtils.initialsFromText(name);
    const city = `${user?.city ?? contact.city}`.trim();
    const headline = `${user?.headline ?? contact.headline ?? user?.statusText ?? ''}`.trim();
    const avatarUrl = this.resolveUserAvatarUrl(user) || contact.avatarUrl;
    const methods = contact.methods
      .map(method => this.toMethodItem(method))
      .filter((method): method is ContactMethodItem => Boolean(method.href));
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

  private toMethodItem(method: ContactMethodDraft): ContactMethodItem {
    const option = this.lookupMethodOption(method.type);
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

  private resolveMethodHref(type: ContactMethodType, value: string): string {
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

  private resolveMethodDisplayValue(type: ContactMethodType, value: string): string {
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

  private normalizeStoredContact(contact: Partial<StoredContact>): StoredContact {
    const name = `${contact.name ?? ''}`.trim() || 'Contact';
    const userId = `${contact.userId ?? ''}`.trim();
    const id = `${contact.id ?? ''}`.trim() || userId || this.randomId('contact');
    const gender = contact.gender === 'woman' ? 'woman' : 'man';
    const methods = (contact.methods ?? [])
      .map(method => this.normalizeMethodDraft(method))
      .filter((method): method is ContactMethodDraft => Boolean(method && method.value));
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

  private normalizeMethodDraft(method: Partial<ContactMethodDraft> | null | undefined): ContactMethodDraft | null {
    if (!method) {
      return null;
    }
    const type = CONTACT_METHOD_OPTION_BY_TYPE.has(method.type as ContactMethodType)
      ? method.type as ContactMethodType
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

  private normalizeContacts(contacts: readonly Partial<StoredContact>[]): StoredContact[] {
    return contacts
      .map(contact => this.normalizeStoredContact(contact))
      .filter(contact => contact.userId || contact.id)
      .sort((left, right) => this.compareContacts(this.toListItem(left), this.toListItem(right)));
  }

  private applyContacts(contacts: readonly Partial<StoredContact>[], optimistic: boolean): void {
    const normalizedContacts = contacts
      .map(contact => this.normalizeStoredContact(contact))
      .filter(contact => contact.userId || contact.id)
      .sort((left, right) => this.compareContacts(this.toListItem(left), this.toListItem(right)));
    this.contactsRef.set(normalizedContacts);
    this.contactCountRef.set(normalizedContacts.length);
    this.bumpRevision(optimistic);
  }

  private async ensureContactsLoadedForActiveUser(): Promise<void> {
    const activeUserId = this.activeUserId();
    if (!activeUserId) {
      return;
    }
    if (this.contactsLoadedForUserId === activeUserId) {
      return;
    }
    if (this.contactsLoadPromise) {
      await this.contactsLoadPromise;
      return;
    }
    const loadPromise = this.loadContactsForActiveUser(activeUserId);
    this.contactsLoadPromise = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (this.contactsLoadPromise === loadPromise) {
        this.contactsLoadPromise = null;
      }
    }
  }

  private async loadContactsForActiveUser(activeUserId: string): Promise<void> {
    const token = ++this.contactLoadToken;
    const contacts = await this.contactsDataService.loadContacts(activeUserId);
    if (token !== this.contactLoadToken || activeUserId !== this.loadedUserId) {
      return;
    }
    this.contactsLoadedForUserId = activeUserId;
    this.applyContacts(contacts, false);
  }

  private compareContacts(
    left: Pick<ContactListItem, 'name' | 'city' | 'updatedAtIso'>,
    right: Pick<ContactListItem, 'name' | 'city' | 'updatedAtIso'>
  ): number {
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

  private resolveUserAvatarUrl(user: UserDto | null | undefined): string {
    return AppUtils.firstImageUrl(user?.images);
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
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

  private closeActionMenu(): void {
    this.openActionMenu.set(null);
  }

  private shouldOpenInlineMenuUp(event: Event): boolean {
    const currentTarget = event.currentTarget;
    if (!(currentTarget instanceof HTMLElement)) {
      return false;
    }
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = currentTarget.getBoundingClientRect();
    return rect.bottom > viewportHeight * 0.68;
  }

  private detectMobileViewport(): boolean {
    return typeof window !== 'undefined' ? window.innerWidth <= 900 : false;
  }
}
