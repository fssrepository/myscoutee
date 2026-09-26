import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppSetupStore } from '../../context/stores/app-setup.store';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { AppSetupPopupComponent } from './app-setup-popup.component';
import { SessionService } from '../../../core/base/services/session.service';
import { DialogStore } from '../../context/stores/dialog.store';


describe('Setup permission help', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('opens above the unchanged setup and closes only the help without requesting permissions', () => {
    const allow = vi.fn(), close = vi.fn();
    const store = {
      isOpen: signal(true), actionPending: signal(false), busy: signal(false),
      notificationConfigurationPending: signal(false), locationMissing: signal(false),
      locationPermission: signal('denied'), locationSelected: signal(false), locationGranted: signal(false),
      notificationsSelected: signal(false), saveSucceeded: signal(false), error: signal(''), allowDisabled: signal(false),
      allow, close,
      pwa: { installPromptVisible: signal(false), installAvailable: signal(false), installActionPending: signal(false) },
      messaging: { notificationPermission: signal('denied'), notificationsConfigured: true }
    };
    TestBed.configureTestingModule({ imports: [AppSetupPopupComponent], providers: [
      { provide: AppSetupStore, useValue: store },
      { provide: SessionService, useValue: { currentSession: () => null } },
      { provide: I18nService, useValue: { revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(AppSetupPopupComponent);
    fixture.detectChanges();
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
      { provide: I18nService, useValue: { revision: () => 0 } }
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

  it('retains the automatic installation offer while signed out', () => {
    const { store } = setup(null);
    store.pwa.installPromptVisible.set(true);
    TestBed.tick();
    expect(store.open).toHaveBeenCalledOnce();
  });
});
