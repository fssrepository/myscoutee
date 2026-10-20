import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';
import { PopupPresenceStore, DialogStore } from '@fssrepository/myscoutee-components';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import { AppSetupPopupComponent } from './app-setup-popup.component';
import { SessionService } from '../../../core/base/services/accounts/session.service';

describe('Setup permission help', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([false, true])('keeps browser guidance and its action visible regardless of detected capability (%s)', externalBrowserAvailable => {
    const openInBrowser = vi.fn(), install = vi.fn(), allow = vi.fn();
    const store = {
      privacyMissing: signal(true), missingCount: () => 4, locationSetupMissing: () => true, openPrivacy: vi.fn(),
      isOpen: signal(true), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false),
      locationPermission: signal('prompt'), locationSelected: signal(false),
      activeControl: signal(null), notificationsSelected: signal(false),
      saveSucceeded: signal(false), error: signal(''), allow, install,
      pwa: { installed: signal(false), externalBrowserAvailable, openInBrowser, installAvailable: signal(false), installActionPending: signal(false), installBusy: signal(false) },
      messaging: { deviceNotificationsEnabled: () => false, notificationPermission: signal(null), notificationsConfigured: false }
    };
    TestBed.configureTestingModule({ imports: [AppSetupPopupComponent], providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: I18nService, useValue: { currentLanguage: () => 'en', revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector('[aria-labelledby="setup-browser"]');
    expect(section).not.toBeNull();
    const installSection = (fixture.nativeElement as HTMLElement).querySelector('[aria-labelledby="setup-install"]')!;
    expect(installSection).not.toBeNull();
    expect(installSection.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(installSection.querySelector('.app-setup-step-badge')?.textContent).toBe('block');
    installSection.querySelector<HTMLButtonElement>('button')!.click();
    expect(install).not.toHaveBeenCalled();
    expect(section?.textContent).toContain('app.setup.open.browser.help');
    expect(section!.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    section!.querySelector<HTMLButtonElement>('button')!.click();
    expect(openInBrowser).toHaveBeenCalledOnce();
    const root = fixture.nativeElement as HTMLElement;
    const privacy = root.querySelector('[data-step="privacy"]')!;
    expect(privacy.querySelector('.app-setup-step-badge')?.textContent).toBe('priority_high');
    expect(privacy.querySelector('.app-menu__counter--alert')).not.toBeNull();
    expect(root.querySelector('.app-setup-step-status')).toBeNull();
    expect(root.querySelector('[data-step="notifications"] .app-setup-step-badge')?.textContent).toBe('block');
    expect(root.querySelector('[data-step="location"] .app-setup-step-badge')?.textContent).toBe('priority_high');
    store.actionPending.set(true);
    fixture.detectChanges();
    expect(root.querySelector('[data-step="location"] .app-setup-step-badge')?.textContent).toBe('priority_high');
    expect(privacy.querySelector('.app-setup-step-badge')?.textContent).toBe('priority_high');
    store.locationPermissionPending.set(true);
    store.notificationConfigurationPending.set(true);
    fixture.detectChanges();
    expect(root.querySelector('[data-step="location"] .app-setup-step-badge')?.textContent).toBe('priority_high');
    expect(root.querySelector('[data-step="notifications"] .app-setup-step-badge')?.textContent).toBe('priority_high');
    store.locationPermissionPending.set(false);
    store.notificationConfigurationPending.set(false);
    store.actionPending.set(false);
    store.privacyMissing.set(false);
    fixture.detectChanges();
    expect(privacy.querySelector('.app-setup-step-badge')?.textContent).toBe('check');
    expect(fixture.componentInstance.privacyActions()[0].palette).toBe('green');
    expect(privacy.querySelector('.app-menu__counter--alert')).toBeNull();
    privacy.querySelector<HTMLButtonElement>('button')!.click();
    expect(store.openPrivacy).toHaveBeenCalledOnce();
    expect(install).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
    store.pwa.installAvailable.set(true);
    fixture.detectChanges();
    expect(installSection.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    expect(installSection.querySelector('.app-setup-step-badge')?.textContent).toBe('priority_high');
    installSection.querySelector<HTMLButtonElement>('button')!.click();
    expect(install).toHaveBeenCalledOnce();
    store.pwa.installAvailable.set(false);
    store.pwa.installActionPending.set(true);
    fixture.detectChanges();
    expect(installSection.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(installSection.querySelector('.app-setup-step-badge')?.textContent).toBe('priority_high');
    expect(installSection.querySelector('.app-setup-step')?.classList.contains('is-blocked')).toBe(false);
    installSection.querySelector<HTMLButtonElement>('button')!.click();
    expect(install).toHaveBeenCalledOnce();
    store.pwa.installBusy.set(true);
    fixture.detectChanges();
    expect(installSection.querySelector('.app-setup-step-badge')?.textContent).toBe('priority_high');
    store.pwa.installed.set(true);
    fixture.detectChanges();
    expect(installSection.querySelector('.app-setup-step-badge')?.textContent).toBe('check');
  });

  it('opens above the unchanged setup and closes only the help without requesting permissions', () => {
    const allow = vi.fn(), close = vi.fn();
    const store = {
      privacyMissing: signal(true), missingCount: () => 4, locationSetupMissing: () => true, openPrivacy: vi.fn(),
      isOpen: signal(true), loginRequested: signal(false), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false), locationMissing: signal(false),
      locationPermission: signal('denied'), locationSelected: signal(false), locationGranted: signal(false),
      activeControl: signal(null), nativePending: signal(false),
      notificationsSelected: signal(false), saveSucceeded: signal(false), error: signal(''), allowDisabled: signal(false),
      allow, close,
      pwa: { installed: signal(false), installPromptVisible: signal(false), installAvailable: signal(false), installActionPending: signal(false), installBusy: signal(false) },
      messaging: { deviceNotificationsEnabled: () => false, notificationPermission: signal('denied'), notificationsConfigured: true }
    };
    TestBed.configureTestingModule({ imports: [AppSetupPopupComponent], providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: SessionService, useValue: { currentSession: () => null } },
      { provide: I18nService, useValue: { currentLanguage: () => 'en', revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-guide-field="permissions-save"]')).toBeNull();
    const root = fixture.nativeElement as HTMLElement;
    const setup = root.querySelector('.ui-popup')!;
    const presence = TestBed.inject(PopupPresenceStore);
    const initialLayer = presence.topLayer();
    const help = root.querySelector<HTMLButtonElement>('button[aria-label="app.setup.help.title"]')!;
    expect(help.nextElementSibling?.classList.contains('ui-popup__close')).toBe(true);
    help.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.ui-popup')).toHaveLength(2);
    expect(root.querySelector('.ui-popup')).toBe(setup);
    expect(presence.topLayer()).toBeGreaterThan(initialLayer);
    expect(root.querySelectorAll('.app-setup-help-card')).toHaveLength(6);
    root.querySelectorAll<HTMLButtonElement>('.ui-popup__close')[1].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.ui-popup')).toHaveLength(1);
    expect(presence.topLayer()).toBe(initialLayer);
    expect(store.isOpen()).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
  });
});

describe('Setup permission progress', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each(['location', 'notifications'] as const)('waits for the native decision before showing the %s ring', control => {
    const store = {
      privacyMissing: signal(true), missingCount: () => 4, locationSetupMissing: () => true, openPrivacy: vi.fn(),
      activeControl: signal(control), nativePending: signal(true), actionPending: signal(true), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false),
      locationPermission: signal('prompt'), locationSelected: signal(control === 'location'),
      notificationsSelected: signal(control === 'notifications'), saveSucceeded: signal(false), error: signal(''),
      messaging: { deviceNotificationsEnabled: () => false, notificationPermission: signal('default'), notificationsConfigured: true }
    };
    TestBed.configureTestingModule({ providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: I18nService, useValue: { translate: (key: string) => key } }
    ] });
    const component = TestBed.runInInjectionContext(() => new AppSetupPopupComponent());
    // The native permission prompt is open: guard repeat clicks, without a ring.
    expect(component.toggles().every(item => item.progress == null)).toBe(true);
    expect(component.toggles().find(item => item.id === control)?.disabled).toBe(true);
    // The existing store starts busy only after the browser grants permission.
    store.busy.set(true);
    expect(component.toggles().find(item => item.id === control)?.progress?.state).toBe('loading');
    expect(component.toggles().find(item => item.id !== control)?.progress).toBeNull();
    store.busy.set(false);
    store.error.set('Permission denied');
    expect(component.toggles().find(item => item.id === control)?.progress?.state).toBe('error');
  });

  it('does not show request rings while reading the initial permission state', () => {
    const store = {
      privacyMissing: signal(true), missingCount: () => 4, locationSetupMissing: () => true, openPrivacy: vi.fn(),
      activeControl: signal(null), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(true), locationPermissionPending: signal(true),
      locationPermission: signal(null), locationSelected: signal(false), notificationsSelected: signal(false),
      saveSucceeded: signal(false), error: signal(''),
      messaging: { deviceNotificationsEnabled: () => false, notificationPermission: signal('default'), notificationsConfigured: false }
    };
    TestBed.configureTestingModule({ providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: I18nService, useValue: { translate: (key: string) => key } }
    ] });
    const component = TestBed.runInInjectionContext(() => new AppSetupPopupComponent());
    expect(component.toggles().every(item => item.progress == null && item.disabled)).toBe(true);
  });
});

describe('Setup automatic installation offer', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(session: unknown) {
    const currentSession = signal(session);
    const store = {
      privacyMissing: signal(true), missingCount: () => 4, locationSetupMissing: () => true, openPrivacy: vi.fn(),
      isOpen: signal(false),
      open: vi.fn(),
      pwa: { installed: signal(false), installPromptVisible: signal(false) }
    };
    TestBed.configureTestingModule({ providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: SessionService, useValue: { currentSession } },
      { provide: DialogStore, useValue: { dialog: signal(null) } },
      { provide: PopupPresenceStore, useValue: { visible: signal(false) } },
      { provide: I18nService, useValue: { currentLanguage: () => 'en', revision: () => 0 } }
    ] });
    TestBed.runInInjectionContext(() => new AppSetupPopupComponent());
    TestBed.tick();
    return { store, currentSession };
  }

  it.each(['demo', 'firebase', 'operator-bootstrap'])('does not open automatically for a %s session before or after profile loading', kind => {
    const { store } = setup({ kind });
    store.pwa.installPromptVisible.set(true);
    TestBed.tick();
    expect(store.open).not.toHaveBeenCalled();
    // A caller may still explicitly open Settings or an entry permission gate.
    store.isOpen.set(true);
    TestBed.tick();
    expect(store.isOpen()).toBe(true);
    expect(store.open).not.toHaveBeenCalled();
  });

  it('does not open permission setup for a signed-out installable browser', () => {
    const { store } = setup(null);
    store.pwa.installPromptVisible.set(true);
    TestBed.tick();
    expect(store.open).not.toHaveBeenCalled();
  });
});
