import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';
import { PopupPresenceStore, DialogStore } from '@fssrepository/myscoutee-components';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import { AppSetupPopupComponent } from './app-setup-popup.component';
import { SessionService } from '../../../core/base/services/accounts/session.service';

describe('Setup permission help', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([false, true])('offers an explicit browser action only for a supported in-app browser (%s)', externalBrowserAvailable => {
    const openInBrowser = vi.fn(), install = vi.fn(), allow = vi.fn();
    const store = {
      isOpen: signal(true), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false),
      locationPermission: signal('prompt'), locationSelected: signal(false),
      activeControl: signal(null), notificationsSelected: signal(false),
      saveSucceeded: signal(false), error: signal(''), allow, install,
      pwa: { externalBrowserAvailable, openInBrowser, installAvailable: signal(false), installActionPending: signal(false) },
      messaging: { notificationPermission: signal(null), notificationsConfigured: false }
    };
    TestBed.configureTestingModule({ imports: [AppSetupPopupComponent], providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: I18nService, useValue: { currentLanguage: () => 'en', revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector('[aria-labelledby="setup-browser"]');
    expect(section !== null).toBe(externalBrowserAvailable);
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-labelledby="setup-install"]')).toBeNull();
    if (externalBrowserAvailable) {
      expect(section?.textContent).toContain('app.setup.open.browser.help');
      section!.querySelector<HTMLButtonElement>('button')!.click();
      expect(openInBrowser).toHaveBeenCalledOnce();
    } else {
      expect(openInBrowser).not.toHaveBeenCalled();
    }
    expect(install).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
  });

  it('opens above the unchanged setup and closes only the help without requesting permissions', () => {
    const allow = vi.fn(), close = vi.fn();
    const store = {
      isOpen: signal(true), loginRequested: signal(false), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false), locationMissing: signal(false),
      locationPermission: signal('denied'), locationSelected: signal(false), locationGranted: signal(false),
      activeControl: signal(null), nativePending: signal(false),
      notificationsSelected: signal(false), saveSucceeded: signal(false), error: signal(''), allowDisabled: signal(false),
      allow, close,
      pwa: { installPromptVisible: signal(false), installAvailable: signal(false), installActionPending: signal(false) },
      messaging: { notificationPermission: signal('denied'), notificationsConfigured: true }
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
      activeControl: signal(control), nativePending: signal(true), actionPending: signal(true), busy: signal(false),
      notificationConfigurationPending: signal(false), locationPermissionPending: signal(false),
      locationPermission: signal('prompt'), locationSelected: signal(control === 'location'),
      notificationsSelected: signal(control === 'notifications'), saveSucceeded: signal(false), error: signal(''),
      messaging: { notificationPermission: signal('default'), notificationsConfigured: true }
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
      activeControl: signal(null), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(true), locationPermissionPending: signal(true),
      locationPermission: signal(null), locationSelected: signal(false), notificationsSelected: signal(false),
      saveSucceeded: signal(false), error: signal(''),
      messaging: { notificationPermission: signal('default'), notificationsConfigured: false }
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
      isOpen: signal(false),
      open: vi.fn(),
      pwa: { installPromptVisible: signal(false) }
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
