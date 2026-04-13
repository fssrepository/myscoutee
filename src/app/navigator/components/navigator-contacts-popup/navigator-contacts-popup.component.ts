import { Component, HostListener, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { from, timer, of, defer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { resolveCurrentDemoDelayMs, resolveCurrentRouteDelayMs } from '../../../shared/core/base/services/route-delay.service';
import {
  SmartListComponent,
  type ListQuery,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import {
  NAVIGATOR_CONTACT_METHOD_OPTIONS,
  NavigatorContactsService,
  type NavigatorContactFormValue,
  type NavigatorContactListFilters,
  type NavigatorContactListItem,
  type NavigatorContactMethodDraft,
  type NavigatorContactMethodItem,
  type NavigatorContactMethodType
} from '../../navigator-contacts.service';

@Component({
  selector: 'app-navigator-contacts-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    SmartListComponent
  ],
  templateUrl: './navigator-contacts-popup.component.html',
  styleUrl: './navigator-contacts-popup.component.scss'
})
export class NavigatorContactsPopupComponent {
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  protected readonly contactsService = inject(NavigatorContactsService);
  protected readonly contactMethodOptions = NAVIGATOR_CONTACT_METHOD_OPTIONS;
  protected readonly isMobileViewport = signal(this.detectMobileViewport());
  protected readonly searchText = signal('');
  protected readonly openActionMenu = signal<{ id: string; openUp: boolean } | null>(null);
  protected readonly editingContact = signal<NavigatorContactFormValue | null>(null);
  protected readonly isFormSavePending = signal(false);
  protected readonly formErrorMessage = signal('');
  protected readonly contactSmartListQuery = computed<Partial<ListQuery<NavigatorContactListFilters>>>(() => ({
    filters: {
      search: this.searchText(),
      refreshToken: this.manualRefreshRevision()
    }
  }));

  private readonly manualRefreshRevision = signal(0);
  private lastKnownTotal = 0;
  private readonly hasInitialLoadCompleted = signal(false);
  private readonly isDeletionsPending = signal(false);

  constructor() {
    effect(() => {
      const revision = this.contactsService.revision();
      const lastOptimistic = this.contactsService.lastOptimisticRevision();
      untracked(() => {
        const currentTotal = this.contactsService.contactCount();
        if (revision && revision === lastOptimistic) {
          if (this.contactsSmartList) {
            const additions = Math.max(0, currentTotal - this.lastKnownTotal);
            const loadedCount = this.contactsSmartList.itemsSnapshot().length;
            this.contactsSmartList.replaceVisibleItems(this.contactsService.contacts().slice(0, loadedCount + additions), {
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

  @ViewChild('contactsSmartList')
  private contactsSmartList?: SmartListComponent<NavigatorContactListItem, NavigatorContactListFilters>;

  protected readonly contactSmartListLoadPage: SmartListLoadPage<NavigatorContactListItem, NavigatorContactListFilters> = (query) =>
    from(this.contactsService.loadContactPage(query)).pipe(
      tap(() => {
        if (!this.hasInitialLoadCompleted()) {
          this.hasInitialLoadCompleted.set(true);
        }
      })
    );

  protected readonly contactSmartListConfig = computed<SmartListConfig<NavigatorContactListItem, NavigatorContactListFilters>>(() => ({
    pageSize: 10,
    loadingDelayMs: 1500,
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
    onDelete: (contact: NavigatorContactListItem, event?: Event) => this.confirmDelete(contact, event)
  }));

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.contactsService.isOpen() || keyboardEvent.defaultPrevented) {
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
    if (target.closest('.navigator-contact-menu-anchor')) {
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
    this.contactsService.closePopup();
  }

  protected async openCreateContactPicker(event?: Event): Promise<void> {
    event?.stopPropagation();
    this.closeActionMenu();
    
    await this.contactsService.openCreateContactPicker();
  }

  protected toggleActionMenu(contact: NavigatorContactListItem, event: Event): void {
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

  protected isActionMenuOpen(contact: NavigatorContactListItem): boolean {
    return this.openActionMenu()?.id === contact.id;
  }

  protected isActionMenuOpenUp(contact: NavigatorContactListItem): boolean {
    const menu = this.openActionMenu();
    return menu?.id === contact.id && menu.openUp;
  }

  protected clearSearch(event?: Event): void {
    event?.stopPropagation();
    this.searchText.set('');
  }

  protected openEditForm(contact: NavigatorContactListItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.formErrorMessage.set('');
    this.editingContact.set(this.contactsService.createFormValue(contact));
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
      methods: [...contact.methods, this.contactsService.createEmptyMethodDraft()]
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

  protected updateMethodType(methodId: string, type: NavigatorContactMethodType): void {
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
      await Promise.all([
        this.contactsService.saveContact(contact),
        this.wait(180)
      ]);
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

  protected confirmDelete(contact: NavigatorContactListItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.confirmationDialogService.open({
      title: `Delete ${contact.name}?`,
      message: 'This removes the contact and all saved availability methods from your local list.',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Unable to delete this contact right now.',
      ringPerimeter: 100,
      onConfirm: async () => {
        this.isDeletionsPending.set(true);

        // Optimistically remove from the visible list
        if (this.contactsSmartList) {
          const current = this.contactsSmartList.itemsSnapshot();
          this.contactsSmartList.replaceVisibleItems(current.filter(i => i.id !== contact.id), {
            total: Math.max(0, (this.contactsSmartList.totalItemCount() ?? current.length) - 1)
          });
        }
        
        // Update lastKnownTotal so the effect knows we already accounted for this deletion
        this.lastKnownTotal = Math.max(0, this.lastKnownTotal - 1);

        try {
          await this.contactsService.deleteContact(contact.id);

          const delayMs = resolveCurrentDemoDelayMs(1500);
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } finally {
          this.isDeletionsPending.set(false);
        }
      }
    });
  }

  protected runMethod(method: NavigatorContactMethodItem, event?: Event): void {
    event?.stopPropagation();
    this.closeActionMenu();
    this.contactsService.triggerMethod(method);
  }

  protected methodOption(type: NavigatorContactMethodType) {
    return this.contactsService.methodOption(type);
  }

  protected methodToneClass(type: NavigatorContactMethodType): string {
    return `navigator-contact-method-tone-${type}`;
  }

  protected methodPanelClasses(type: NavigatorContactMethodType): string[] {
    return [
      'selector-options-panel',
      'profile-bottom-sheet-panel',
      'navigator-contact-method-panel',
      this.methodToneClass(type)
    ];
  }

  protected trackMethod(_index: number, method: NavigatorContactMethodDraft): string {
    return `${method.id}:${method.type}`;
  }

  protected visibleMethodChips(contact: NavigatorContactListItem): NavigatorContactMethodItem[] {
    return contact.methods.slice(0, 4);
  }

  protected hiddenMethodCount(contact: NavigatorContactListItem): number {
    return Math.max(0, contact.methods.length - 4);
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

  private async wait(delayMs: number): Promise<void> {
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }
}
