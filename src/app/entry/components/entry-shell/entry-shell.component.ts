import { ChangeDetectorRef, Component, EventEmitter, HostListener, Injector, Input, NgZone, Output, inject } from '@angular/core';

import { AppContext, USERS_LOAD_CONTEXT_KEY, UsersService, type DemoUserListItemDto } from '../../../shared/core';
import type { DemoBootstrapProgressStage } from '../../../shared/core/demo';
import type * as AppTypes from '../../../shared/core/base/models';
import type { LocationCoordinates } from '../../../shared/core/base/interfaces/location.interface';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { EntryConsentPopupComponent } from '../entry-consent-popup/entry-consent-popup.component';
import { EntryDemoUserSelectorComponent } from '../entry-demo-user-selector/entry-demo-user-selector.component';
import { EntryFirebaseAuthPopupComponent } from '../entry-firebase-auth-popup/entry-firebase-auth-popup.component';
import { EntryLandingComponent } from '../entry-landing/entry-landing.component';

@Component({
  selector: 'app-entry-shell',
  standalone: true,
  imports: [
    EntryLandingComponent,
    EntryConsentPopupComponent,
    EntryDemoUserSelectorComponent,
    EntryFirebaseAuthPopupComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './entry-shell.component.html',
  styleUrl: './entry-shell.component.scss'
})
export class EntryShellComponent {
  private static readonly ENTRY_CONSENT_KEY = 'entry-gdpr-consent';
  private static readonly ENTRY_CONSENT_AUDIT_KEY = 'entry-gdpr-consent-audit';
  private static readonly ENTRY_CONSENT_VERSION = '2026-02-26-v1';
  private static readonly ENTRY_CONSENT_AUDIT_MAX = 30;

  private readonly injector = inject(Injector);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly appCtx = inject(AppContext);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private usersServiceRef: UsersService | null = null;
  private loginEligibilityBusy = false;

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
  protected demoSelectorLoadingProgress = 0;
  protected demoSelectorLoadingLabel = 'Preparing demo data';
  protected demoSelectorLoadingStage: DemoBootstrapProgressStage = 'selector';
  protected demoSelectorErrorMessage = '';
  protected demoSelectorSubmitting = false;
  protected showFirebaseAuthPopup = false;
  private demoSelectorRequestToken = 0;

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
      if (this.demoSelectorSubmitting) {
        return;
      }
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

  protected openEntryDemo(): void {
    if (!this.ensureEntryConsent()) {
      return;
    }
    this.openDemoUserSelectorPopup();
  }

  protected async openEntryFirebaseAuth(): Promise<void> {
    if (!this.ensureEntryConsent()) {
      return;
    }
    if (this.authMode !== 'firebase') {
      this.openDemoUserSelectorPopup();
      return;
    }
    if (this.loginEligibilityBusy) {
      return;
    }
    const allowed = await this.ensureHttpLoginAccessAllowed();
    if (!allowed) {
      return;
    }
    if (this.firebaseAuthProfile) {
      this.firebaseSessionContinueRequested.emit();
      return;
    }
    this.showFirebaseAuthPopup = true;
  }

  protected closeFirebaseAuthPopup(): void {
    this.showFirebaseAuthPopup = false;
  }

  protected closeDemoUserSelectorPopup(): void {
    if (this.demoSelectorSubmitting) {
      return;
    }
    this.demoSelectorRequestToken += 1;
    this.showUserSelector = false;
    this.demoSelectorLoading = false;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
  }

  protected onSelectDemoUser(userId: string): void {
    if (this.demoSelectorLoading || this.demoSelectorSubmitting) {
      return;
    }
    const requestToken = this.demoSelectorRequestToken;
    this.demoSelectorSubmitting = true;
    this.demoSelectorLoading = true;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo session';
    this.demoSelectorLoadingStage = 'session';
    void this.prepareSelectedDemoUser(userId, requestToken);
  }

  protected onContinueWithFirebaseAuth(): void {
    if (this.firebaseAuthIsBusy) {
      return;
    }
    this.firebaseAuthRequested.emit();
  }

  protected retryDemoUserSelectorPopup(): void {
    if (this.demoSelectorLoading || this.demoSelectorSubmitting) {
      return;
    }
    this.openDemoUserSelectorPopup();
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
    this.demoSelectorLoading = false;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
    this.showFirebaseAuthPopup = false;
  }

  private get usersService(): UsersService {
    if (!this.usersServiceRef) {
      this.usersServiceRef = this.injector.get(UsersService);
    }
    return this.usersServiceRef;
  }

  private ensureEntryConsent(): boolean {
    if (this.hasEntryConsent) {
      return true;
    }
    this.entryConsentViewOnly = false;
    this.showEntryConsentPopup = true;
    return false;
  }

  private async ensureHttpLoginAccessAllowed(): Promise<boolean> {
    this.loginEligibilityBusy = true;
    try {
      const gateState = await this.usersService.checkLocationEligibility();
      if (gateState.securityGateEnabled !== true) {
        return true;
      }

        const coordinates = await this.requestCurrentLocation();
        if (!coordinates) {
          this.confirmationDialogService.openInfo(
          'We need your location before login so we can apply the region-based security check.',
          {
            title: 'Location Required For Login',
            confirmLabel: 'OK'
          }
        );
        return false;
      }

      const result = await this.usersService.checkLocationEligibility(coordinates);
      if (result.eligible) {
        return true;
      }

      this.confirmationDialogService.openInfo(
        result.message?.trim() || 'Login is currently unavailable from your country or region for security reasons. Please come back later.',
        {
          title: 'Login Unavailable',
          confirmLabel: 'OK'
        }
      );
      return false;
    } catch {
      this.confirmationDialogService.openInfo(
        'We could not complete the region-based check right now. Please try again later.',
        {
          title: 'Check Unavailable',
          confirmLabel: 'OK'
        }
      );
      return false;
    } finally {
      this.loginEligibilityBusy = false;
    }
  }

  private openDemoUserSelectorPopup(): void {
    const requestToken = ++this.demoSelectorRequestToken;
    this.showUserSelector = true;
    this.demoSelectorUsers = [];
    this.demoSelectorLoading = true;
    this.demoSelectorLoadingProgress = 0;
    this.demoSelectorLoadingLabel = 'Preparing demo data';
    this.demoSelectorLoadingStage = 'selector';
    this.demoSelectorErrorMessage = '';
    this.demoSelectorSubmitting = false;
    void this.loadDemoSelectorUsers(requestToken);
  }

  private async loadDemoSelectorUsers(requestToken: number): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentDemoSelectorRequest(requestToken)) {
      return;
    }

    try {
      const users = await this.usersService.loadAvailableDemoUsers(undefined, state => {
        if (!this.isCurrentDemoSelectorRequest(requestToken)) {
          return;
        }
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoadingProgress = state.percent;
          this.demoSelectorLoadingLabel = state.label;
          this.demoSelectorLoadingStage = state.stage;
        });
      });
      const loadState = this.appCtx.getLoadingState(USERS_LOAD_CONTEXT_KEY);
      const selectorErrorMessage = users.length === 0
        && (loadState.status === 'timeout' || loadState.status === 'error')
        ? (loadState.error?.trim() || 'Unable to load demo users right now.')
        : '';
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorUsers = users;
        this.demoSelectorErrorMessage = selectorErrorMessage;
        this.demoSelectorLoadingProgress = selectorErrorMessage ? 0 : 100;
        this.demoSelectorLoadingLabel = selectorErrorMessage ? 'Retry demo selector' : 'Demo data ready';
        this.demoSelectorLoadingStage = selectorErrorMessage ? 'selector' : 'ready';
      });
      if (selectorErrorMessage) {
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoading = false;
        });
        return;
      }
      await this.waitForLoaderCompletionBeat();
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoading = false;
      });
    } catch {
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoading = false;
        this.demoSelectorErrorMessage = this.appCtx.getLoadingState(USERS_LOAD_CONTEXT_KEY).error?.trim()
          || 'Unable to load demo users right now.';
      });
    }
  }

  private async prepareSelectedDemoUser(userId: string, requestToken: number): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentDemoSelectorRequest(requestToken)) {
      return;
    }

    try {
      await this.usersService.prepareDemoUserSession(userId, state => {
        if (!this.isCurrentDemoSelectorRequest(requestToken)) {
          return;
        }
        this.commitDemoSelectorState(() => {
          this.demoSelectorLoadingProgress = state.percent;
          this.demoSelectorLoadingLabel = state.label;
          this.demoSelectorLoadingStage = state.stage;
        });
      });
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoadingProgress = 100;
        this.demoSelectorLoadingLabel = 'Demo session ready';
        this.demoSelectorLoadingStage = 'sessionReady';
      });
      await this.waitForLoaderCompletionBeat();
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.demoUserSelected.emit(userId);
    } catch {
      if (!this.isCurrentDemoSelectorRequest(requestToken)) {
        return;
      }
      this.commitDemoSelectorState(() => {
        this.demoSelectorLoading = false;
        this.demoSelectorSubmitting = false;
        this.demoSelectorLoadingProgress = 0;
        this.demoSelectorLoadingLabel = 'Preparing demo data';
        this.demoSelectorLoadingStage = 'selector';
      });
    }
  }

  private isCurrentDemoSelectorRequest(requestToken: number): boolean {
    return this.showUserSelector && this.demoSelectorRequestToken === requestToken;
  }

  private async requestCurrentLocation(): Promise<LocationCoordinates | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise<LocationCoordinates | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            resolve(null);
            return;
          }
          resolve({ latitude, longitude });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000
        }
      );
    });
  }

  private waitForPopupPaint(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTimeout(resolve, 80);
          });
        });
        return;
      }
      setTimeout(resolve, 80);
    });
  }

  private waitForLoaderCompletionBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 240));
  }

  private commitDemoSelectorState(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetectorRef.detectChanges();
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
