import { Component, ViewContainerRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EntryPageComponent } from './entry-page.component';
import { EntryFirebaseAuthPopupComponent } from '../entry-firebase-auth-popup/entry-firebase-auth-popup.component';
import { ProfileOnboardingPopupComponent } from '../profile-onboarding-popup/profile-onboarding-popup.component';
import { UsersService } from '../../../shared/core/base/services/accounts/users.service';

@Component({ template: '<ng-container #host></ng-container>' })
class PopupHost {
  readonly host = viewChild.required('host', { read: ViewContainerRef });
  owner?: EntryPageComponent;
  ngDoCheck(): void { this.owner?.ngDoCheck(); }
}

function popupOwner() {
  TestBed.configureTestingModule({ imports: [PopupHost], providers: [{ provide: UsersService, useValue: {} }] });
  TestBed.overrideComponent(EntryFirebaseAuthPopupComponent, { set: { imports: [], template: '' } });
  TestBed.overrideComponent(ProfileOnboardingPopupComponent, { set: { imports: [], template: '' } });
  const fixture = TestBed.createComponent(PopupHost);
  fixture.detectChanges();
  const values = {
    destroyRef: { destroyed: false },
    firebaseAuthPopupHost: () => fixture.componentInstance.host(),
    onboardingPopupHost: () => fixture.componentInstance.host(),
    firebaseAuthPopup: signal(null), onboardingPopup: signal(null),
    firebaseAuthPopupInputs: signal({ open: false, mobile: false }),
    onboardingPopupInputs: signal({ open: false, user: null, mobile: false, title: '', message: '' }),
    firebaseAuthPopupLoad: null, onboardingPopupLoad: null,
    showFirebaseAuthPopup: true, firebaseAuthIsBusy: false, firebaseAuthMessage: 'status', isMobileView: true,
    onboardingOpen: false, onboardingUser: null, onboardingTitle: 'profile.setup', onboardingMessage: 'profile status',
    closeFirebaseAuthPopup: vi.fn(), onRequestFirebaseAuth: vi.fn(),
    onOnboardingCompleted: vi.fn(), onOnboardingDismissed: vi.fn()
  };
  const owner = Object.create(EntryPageComponent.prototype, Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { value, writable: true, configurable: true }])
  ));
  const busy = signal(false);
  Object.defineProperty(owner, 'firebaseAuthIsBusy', { get: () => busy(), set: value => busy.set(value) });
  fixture.componentInstance.owner = owner;
  return { fixture, owner, host: fixture.componentInstance.host() };
}

afterEach(() => TestBed.resetTestingModule());

it('opens the first lazy auth popup with its current inputs before another parent check or click', async () => {
  const { fixture, owner } = popupOwner();
  await owner.ensureFirebaseAuthPopupLoaded();
  const popup = owner.firebaseAuthPopup();
  popup.changeDetectorRef.detectChanges();
  expect(popup.instance.open).toBe(true);
  expect(popup.instance.isMobileView).toBe(true);
  fixture.destroy();
});

it('loads one auth popup on demand and preserves live inputs, outputs and close during loading', async () => {
  const { fixture, owner, host } = popupOwner();
  expect(owner.firebaseAuthPopup()).toBeNull();
  expect(host.length).toBe(0);
  const load = owner.ensureFirebaseAuthPopupLoaded();
  expect(owner.ensureFirebaseAuthPopupLoaded()).toBe(load);
  owner.showFirebaseAuthPopup = false;
  await load;
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  const popup = owner.firebaseAuthPopup().instance as EntryFirebaseAuthPopupComponent;
  expect(popup.open).toBe(false);
  expect(popup.statusMessage).toBe('status');
  expect(popup.isMobileView).toBe(true);
  owner.showFirebaseAuthPopup = true;
  owner.firebaseAuthIsBusy = true;
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  expect(popup.open).toBe(true);
  expect(popup.busy).toBe(true);
  popup.closeRequested.emit();
  popup.authRequested.emit({ provider: 'google' });
  expect(owner.closeFirebaseAuthPopup).toHaveBeenCalledOnce();
  expect(owner.onRequestFirebaseAuth).toHaveBeenCalledWith({ provider: 'google' });
  await owner.ensureFirebaseAuthPopupLoaded();
  expect(host.length).toBe(1);
  fixture.destroy();
});

it('preserves onboarding inputs and completion/dismissal outputs after lazy loading', async () => {
  const { fixture, owner, host } = popupOwner();
  await owner.ensureOnboardingPopupLoaded();
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  const popup = owner.onboardingPopup().instance as ProfileOnboardingPopupComponent;
  expect(popup.open).toBe(false);
  expect(popup.mobile).toBe(true);
  expect(popup.title).toBe('profile.setup');
  expect(popup.message).toBe('profile status');
  const user = { id: 'test-user' } as Parameters<typeof popup.completed.emit>[0];
  popup.completed.emit(user);
  popup.dismissed.emit();
  expect(owner.onOnboardingCompleted).toHaveBeenCalledWith(user);
  expect(owner.onOnboardingDismissed).toHaveBeenCalledOnce();
  await owner.ensureOnboardingPopupLoaded();
  expect(host.length).toBe(1);
  fixture.destroy();
});

it('does not mount a popup after its owning page has been destroyed', async () => {
  const { fixture, owner, host } = popupOwner();
  const load = owner.ensureOnboardingPopupLoaded();
  owner.destroyRef.destroyed = true;
  await load;
  expect(host.length).toBe(0);
  expect(owner.onboardingPopup()).toBeNull();
  fixture.destroy();
});

it('keeps the lazy login popup mobile at 760px and updates its input after a desktop resize', async () => {
  let width = 760;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width <= Number(query.match(/max-width:\s*([\d.]+)px/)?.[1] ?? 0)
  }));
  const { fixture, owner } = popupOwner();
  owner.onWindowResize();
  await owner.ensureFirebaseAuthPopupLoaded();
  fixture.detectChanges();
  const popup = owner.firebaseAuthPopup().instance as EntryFirebaseAuthPopupComponent;
  expect(popup.isMobileView).toBe(true);
  width = 761;
  owner.onWindowResize();
  expect(owner.isMobileView).toBe(false);
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  expect(popup.isMobileView).toBe(false);
  fixture.destroy();
});

it('shares the on-demand document constructor and ignores completion after route destruction', async () => {
  const { fixture, owner } = popupOwner();
  let finish!: (value: any) => void;
  owner.documentViewerComponent = signal(null);
  owner.documentViewerLoad = null;
  owner.popupErrors = { handleError: vi.fn() };
  owner.popupAdapters = { load: vi.fn(() => new Promise(resolve => { finish = resolve; })) };
  const first = owner.ensureDocumentViewerLoaded();
  expect(owner.ensureDocumentViewerLoaded()).toBe(first);
  owner.destroyRef.destroyed = true;
  finish({ DocumentViewerComponent: class {} });
  await first;
  expect(owner.documentViewerComponent()).toBeNull();
  expect(owner.popupAdapters.load).toHaveBeenCalledTimes(1);
  fixture.destroy();
});

it('retries a failed document load when the user opens it again and caches the constructor', async () => {
  const { fixture, owner } = popupOwner();
  class DocumentViewer {}
  const error = new Error('network');
  owner.documentViewerComponent = signal(null);
  owner.documentViewerLoad = null;
  owner.popupErrors = { handleError: vi.fn() };
  owner.popupAdapters = { load: vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ DocumentViewerComponent: DocumentViewer }) };
  await owner.ensureDocumentViewerLoaded();
  expect(owner.popupErrors.handleError).toHaveBeenCalledExactlyOnceWith(error);
  expect(owner.documentViewerComponent()).toBeNull();
  await owner.ensureDocumentViewerLoaded();
  expect(owner.documentViewerComponent()).toBe(DocumentViewer);
  await owner.ensureDocumentViewerLoaded();
  expect(owner.popupAdapters.load).toHaveBeenCalledTimes(2);
  fixture.destroy();
});
