import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

import { UsersService } from '../../shared/core/users.service';
import type { DemoUserListItemDto } from '../../shared/core/user.interface';
import type * as AppTypes from '../../shared/app-types';
import { EntryConsentPopupComponent } from './entry-consent-popup.component';
import { EntryDemoUserSelectorComponent } from './entry-demo-user-selector.component';
import { EntryFirebaseAuthPopupComponent } from './entry-firebase-auth-popup.component';
import { EntryLandingComponent } from './entry-landing.component';

@Component({
  selector: 'app-entry-shell',
  standalone: true,
  imports: [
    EntryLandingComponent,
    EntryConsentPopupComponent,
    EntryDemoUserSelectorComponent,
    EntryFirebaseAuthPopupComponent
  ],
  templateUrl: './entry-shell.component.html',
  styleUrl: './entry-shell.component.scss'
})
export class EntryShellComponent {
  private static readonly ENTRY_CONSENT_KEY = 'entry-gdpr-consent';
  private static readonly ENTRY_CONSENT_AUDIT_KEY = 'entry-gdpr-consent-audit';
  private static readonly ENTRY_CONSENT_VERSION = '2026-02-26-v1';
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;

  private readonly usersService = inject(UsersService);

  @Input({ required: true }) authMode: AppTypes.AuthMode = 'selector';
  @Input() firebaseAuthProfile: AppTypes.FirebaseAuthProfile | null = null;
  @Input() firebaseAuthIsBusy = false;
  @Input() isMobileView = false;

  @Output() readonly demoUserSelected = new EventEmitter<string>();
  @Output() readonly firebaseAuthRequested = new EventEmitter<void>();
  @Output() readonly firebaseSessionContinueRequested = new EventEmitter<void>();

  protected showEntryConsentPopup = false;
  protected entryConsentViewOnly = false;
  protected showUserSelector = false;
  protected demoSelectorUsers: DemoUserListItemDto[] = [];
  protected demoSelectorLoading = false;
  protected showFirebaseAuthPopup = false;

  constructor() {
    this.initializeEntryFlow();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onGlobalEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.showUserSelector) {
      keyboardEvent.stopPropagation();
      this.closeDemoUserSelectorPopup();
      return;
    }
    if (this.showFirebaseAuthPopup) {
      keyboardEvent.stopPropagation();
      this.closeFirebaseAuthPopup();
    }
  }

  protected get hasEntryConsent(): boolean {
    return this.loadEntryConsentState() !== null;
  }

  protected openEntryAuth(): void {
    if (!this.hasEntryConsent) {
      this.entryConsentViewOnly = false;
      this.showEntryConsentPopup = true;
      return;
    }
    if (this.authMode === 'firebase') {
      if (this.firebaseAuthProfile) {
        this.firebaseSessionContinueRequested.emit();
        return;
      }
      this.showFirebaseAuthPopup = true;
      return;
    }
    this.openDemoUserSelectorPopup();
  }

  protected closeFirebaseAuthPopup(): void {
    this.showFirebaseAuthPopup = false;
  }

  protected closeDemoUserSelectorPopup(): void {
    this.showUserSelector = false;
    this.demoSelectorLoading = false;
  }

  protected onSelectDemoUser(userId: string): void {
    if (this.demoSelectorLoading) {
      return;
    }
    this.demoSelectorLoading = true;
    this.demoUserSelected.emit(userId);
  }

  protected onContinueWithFirebaseAuth(): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    this.firebaseAuthRequested.emit();
  }

  protected openEntryConsentPopup(viewOnly = false): void {
    this.entryConsentViewOnly = viewOnly;
    this.showEntryConsentPopup = true;
  }

  protected closeEntryConsentPopup(): void {
    if (!this.entryConsentViewOnly && !this.hasEntryConsent) {
      return;
    }
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected acceptEntryConsent(): void {
    const nowIso = new Date().toISOString();
    const consent: AppTypes.EntryConsentState = {
      version: EntryShellComponent.ENTRY_CONSENT_VERSION,
      accepted: true,
      acceptedAtIso: nowIso
    };
    localStorage.setItem(EntryShellComponent.ENTRY_CONSENT_KEY, JSON.stringify(consent));
    this.appendEntryConsentAudit('accepted', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  protected rejectEntryConsent(): void {
    const nowIso = new Date().toISOString();
    localStorage.removeItem(EntryShellComponent.ENTRY_CONSENT_KEY);
    this.appendEntryConsentAudit('rejected', nowIso);
    this.showEntryConsentPopup = false;
    this.entryConsentViewOnly = false;
  }

  private initializeEntryFlow(): void {
    const hasConsent = this.loadEntryConsentState() !== null;
    this.entryConsentViewOnly = false;
    this.showEntryConsentPopup = !hasConsent;
    this.showUserSelector = false;
    this.showFirebaseAuthPopup = false;
  }

  private openDemoUserSelectorPopup(): void {
    this.showUserSelector = true;
    this.demoSelectorUsers = [];
    this.demoSelectorLoading = true;
    void this.usersService.loadAvailableDemoUsers().then(users => {
      this.demoSelectorUsers = users;
      this.demoSelectorLoading = false;
    }).catch(() => {
      this.demoSelectorLoading = false;
    });
  }

  private loadEntryConsentState(): AppTypes.EntryConsentState | null {
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppTypes.EntryConsentState>;
      if (
        parsed.version !== EntryShellComponent.ENTRY_CONSENT_VERSION ||
        parsed.accepted !== true ||
        typeof parsed.acceptedAtIso !== 'string' ||
        parsed.acceptedAtIso.length === 0
      ) {
        return null;
      }
      return {
        version: parsed.version,
        accepted: true,
        acceptedAtIso: parsed.acceptedAtIso
      };
    } catch {
      return null;
    }
  }

  private appendEntryConsentAudit(action: AppTypes.EntryConsentAuditRecord['action'], tsIso: string): void {
    const record: AppTypes.EntryConsentAuditRecord = {
      tsIso,
      action,
      version: EntryShellComponent.ENTRY_CONSENT_VERSION,
      source: 'entry',
      userAgent: navigator.userAgent
    };
    const existing = this.loadEntryConsentAudit();
    existing.unshift(record);
    const trimmed = existing.slice(0, EntryShellComponent.ENTRY_CONSENT_AUDIT_MAX);
    localStorage.setItem(EntryShellComponent.ENTRY_CONSENT_AUDIT_KEY, JSON.stringify(trimmed));
  }

  private loadEntryConsentAudit(): AppTypes.EntryConsentAuditRecord[] {
    const raw = localStorage.getItem(EntryShellComponent.ENTRY_CONSENT_AUDIT_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as AppTypes.EntryConsentAuditRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
