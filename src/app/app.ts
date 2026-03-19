import { ChangeDetectorRef, Component, HostListener, Injectable, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { AlertService } from './shared/alert.service';
import {
  AppContext,
  SessionService,
  type ConnectivityState,
  type UserDto
} from './shared/core';
import {
  APP_DEMO_DATA,
  DEMO_EVENTS_BY_USER,
  DEMO_HOSTING_BY_USER,
  DEMO_USERS,
  DemoUser
} from './shared/demo-data';
import { NavigatorBindings, NavigatorComponent, NavigatorService } from './navigator';
import { AppDemoGenerators } from './shared/app-demo-generators';
import { AppUtils } from './shared/app-utils';
import { EventFeedbackPopupService } from './activity/event-feedback-popup.service';
import type { EventFeedbackPopupHost } from './activity/event-feedback-popup.host';

@Injectable()
class YearMonthDayDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (match) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return new Date(year, month - 1, day);
        }
      }
    }
    return super.parse(value);
  }

  override format(date: Date, displayFormat: object): string {
    if (`${displayFormat}` === 'ymdInput') {
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${date.getFullYear()}/${month}/${day}`;
    }
    if (`${displayFormat}` === 'hmInput') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return super.format(date, displayFormat);
  }
}

const APP_DATE_FORMATS = {
  parse: {
    dateInput: 'ymdInput',
    timeInput: 'hmInput'
  },
  display: {
    dateInput: 'ymdInput',
    timeInput: 'hmInput',
    timeOptionLabel: 'hmInput',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

@Component({
  selector: 'app-core',
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    NavigatorComponent
  ],
  providers: [
    { provide: DateAdapter, useClass: YearMonthDayDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS }
  ],
  templateUrl: './app.html',
  styleUrl: '../_styles/app.scss'
})
export class App implements OnDestroy, EventFeedbackPopupHost {
  private static readonly DEMO_ACTIVE_USER_KEY = 'demo-active-user';

  public readonly alertService = inject(AlertService);
  private readonly sessionService = inject(SessionService);
  private readonly appCtx = inject(AppContext);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly navigatorService = inject(NavigatorService);
  private readonly eventFeedbackPopupService = inject(EventFeedbackPopupService);

  public readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);
  protected activePopup: 'logoutConfirm' | 'deleteAccountConfirm' | null = null;
  protected activeUserId = this.getInitialUserId();

  public readonly eventDatesById: Record<string, string> = { ...APP_DEMO_DATA.eventDatesById };
  public readonly activityImageById: Record<string, string> = { ...APP_DEMO_DATA.activityImageById };
  protected readonly hostingDatesById: Record<string, string> = { ...APP_DEMO_DATA.hostingDatesById };
  protected readonly eventItemsByUser = AppUtils.cloneMapItems(DEMO_EVENTS_BY_USER);
  protected readonly hostingItemsByUser = AppUtils.cloneMapItems(DEMO_HOSTING_BY_USER);

  private readonly navigatorBindings: NavigatorBindings = {
    syncHydratedUser: user => {
      if (!this.users.some(candidate => candidate.id === user.id)) {
        return;
      }
      this.syncHydratedUserIntoLocalState(user);
      this.activeUserId = user.id;
      this.cdr.markForCheck();
    },
    openDeleteAccountConfirm: () => this.openDeleteAccountConfirm(),
    openLogoutConfirm: () => this.openLogoutConfirm()
  };

  constructor(
    private readonly router: Router
  ) {
    this.navigatorService.registerBindings(this.navigatorBindings);
    this.eventFeedbackPopupService.registerHost(this);
    this.ensurePaginationTestEvents(30);
    this.appCtx.setConnectivityState(this.browserConnectivityState());
  }

  ngOnDestroy(): void {
    this.navigatorService.clearBindings(this.navigatorBindings);
    this.navigatorService.clearHydratedUser();
  }

  @HostListener('window:online')
  protected onWindowOnline(): void {
    this.appCtx.setConnectivityState('online');
  }

  @HostListener('window:offline')
  protected onWindowOffline(): void {
    this.appCtx.setConnectivityState('offline');
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented || !this.activePopup) {
      return;
    }
    keyboardEvent.stopPropagation();
    this.closePopup();
  }

  public get activeUser(): DemoUser {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0] ?? DEMO_USERS[0];
  }

  public eventStartAtMs(eventId: string): number | null {
    const iso = this.eventDatesById[eventId] ?? this.hostingDatesById[eventId];
    if (!iso) {
      return null;
    }
    const value = new Date(iso).getTime();
    return Number.isNaN(value) ? null : value;
  }

  public eventTitleById(eventId: string): string {
    const eventTitle = this.eventItems.find(item => item.id === eventId)?.title;
    if (eventTitle) {
      return eventTitle;
    }
    return this.hostingItems.find(item => item.id === eventId)?.title ?? 'this event';
  }

  protected openDeleteAccountConfirm(): void {
    this.activePopup = 'deleteAccountConfirm';
  }

  protected openLogoutConfirm(): void {
    this.activePopup = 'logoutConfirm';
  }

  protected confirmDeleteAccount(): void {
    this.alertService.open('Delete account flow is ready for backend wiring.');
    this.closePopup();
    this.navigatorService.closeMenu();
  }

  protected closePopup(): void {
    this.activePopup = null;
  }

  protected closePopupFromBackdrop(event: MouseEvent): void {
    event.stopPropagation();
    this.closePopup();
  }

  protected confirmLogout(): void {
    this.activePopup = null;
    this.navigatorService.closeMenu();
    this.navigatorService.clearHydratedUser();
    void this.sessionService.logout().finally(() => {
      void this.router.navigate(['/entry']);
      this.cdr.markForCheck();
    });
  }

  private browserConnectivityState(): ConnectivityState {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'offline';
    }
    return 'online';
  }

  private ensurePaginationTestEvents(minEventsPerUser: number): void {
    for (const user of this.users) {
      const userId = user.id;
      const events = this.eventItemsByUser[userId] ?? [];
      if (events.length >= minEventsPerUser) {
        continue;
      }

      const needed = minEventsPerUser - events.length;
      const synthetic = [];
      for (let index = 0; index < needed; index += 1) {
        const seq = events.length + index + 1;
        const id = `ex-${userId}-${seq}`;
        const start = new Date(2026, 2, 1 + (index * 2), 10 + (index % 6), (index % 2) * 30, 0, 0);
        const end = new Date(start.getTime() + ((2 + (index % 3)) * 60 * 60 * 1000));
        synthetic.push({
          id,
          avatar: user.initials,
          title: `Pagination Test Event ${seq}`,
          shortDescription: `Synthetic feed item ${seq} to validate activities infinite loading.`,
          timeframe: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          activity: (index % 5) + 1,
          isAdmin: (seq % 4) === 0
        });
        this.eventDatesById[id] = start.toISOString().slice(0, 19);
      }

      this.eventItemsByUser[userId] = [...events, ...synthetic];
    }
  }

  private getInitialUserId(): string {
    const currentSession = this.sessionService.currentSession();
    if (
      currentSession?.kind === 'demo' &&
      this.users.some(user => user.id === currentSession.userId)
    ) {
      return currentSession.userId;
    }
    const stored = localStorage.getItem(App.DEMO_ACTIVE_USER_KEY);
    if (stored && this.users.some(user => user.id === stored)) {
      return stored;
    }
    return this.users[0]?.id ?? DEMO_USERS[0].id;
  }

  private syncHydratedUserIntoLocalState(user: UserDto): void {
    const localUser = this.users.find(candidate => candidate.id === user.id);
    if (!localUser) {
      return;
    }

    localUser.name = user.name;
    localUser.age = user.age;
    localUser.birthday = user.birthday;
    localUser.city = user.city;
    localUser.height = user.height;
    localUser.physique = user.physique;
    localUser.languages = [...(user.languages ?? [])];
    localUser.horoscope = user.horoscope;
    localUser.initials = user.initials;
    localUser.gender = user.gender;
    localUser.statusText = user.statusText;
    localUser.hostTier = user.hostTier;
    localUser.traitLabel = user.traitLabel;
    localUser.completion = user.completion;
    localUser.headline = user.headline;
    localUser.about = user.about;
    localUser.profileStatus = user.profileStatus;
    localUser.activities = {
      game: user.activities?.game ?? localUser.activities.game,
      chat: user.activities?.chat ?? localUser.activities.chat,
      invitations: user.activities?.invitations ?? localUser.activities.invitations,
      events: user.activities?.events ?? localUser.activities.events,
      hosting: user.activities?.hosting ?? localUser.activities.hosting
    };

    const explicitImages = (user.images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0)
      .slice(0, 8);
    localUser.images = [...explicitImages];
  }

  public get eventItems() {
    return this.eventItemsByUser[this.activeUser.id] ?? this.eventItemsByUser['u1'] ?? [];
  }

  private get hostingItems() {
    return this.hostingItemsByUser[this.activeUser.id] ?? this.hostingItemsByUser['u1'] ?? [];
  }
}
