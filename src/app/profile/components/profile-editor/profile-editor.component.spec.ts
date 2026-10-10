import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FormFlowComponent, ExplanationGuideService } from '@fssrepository/myscoutee-components';
import { TestBed } from '@angular/core/testing';
import { ProfileEditorComponent } from './profile-editor.component';
import { ProfileExtDto } from '../../../shared/core/contracts/user.interface';

import { UsersService } from '../../../shared/core';
import { UserProfileStore } from '../../../shared/ui/context/stores/profile/user-profile.store';
import { ProfileStore } from '../../../shared/ui/context/stores/profile/profile.store';

@Component({
  selector: 'app-image-carousel', standalone: true, template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: ImageEditorStub, multi: true }]
})
class ImageEditorStub {
  writeValue() {} registerOnChange() {} registerOnTouched() {}
}

describe('profile editor prepared state', () => {
  function profile(id: string, name = 'Anna') {
    const value = new ProfileExtDto();
    value.profile.id = id; value.profile.name = name;
    return value;
  }
  const id = signal('a');
  const current = signal<ProfileExtDto | null>(null);
  const save = vi.fn();
  beforeEach(() => {
    id.set('a'); current.set(profile('a')); save.mockReset();
    TestBed.configureTestingModule({ imports: [ProfileEditorComponent], providers: [
      { provide: UserProfileStore, useValue: {
        activeUserId: id, activeUserProfileExt: current,
        activeUserIsAdmin: () => false, activeUserIsOperator: () => false
      } },
      { provide: UsersService, useValue: { saveUserProfileExt: save } },
      { provide: ExplanationGuideService, useValue: { registerContext: () => () => {} } }
    ] });
    // Exercise the editor's real state/effects/converters separately from the
    // shared form and retained-popup DOM contracts tested by their own suites.
  });
  afterEach(() => TestBed.resetTestingModule());
  function fixture(stateOnly = true) {
    if (stateOnly) TestBed.overrideComponent(ProfileEditorComponent, { set: { template: '', imports: [] } });
    const f = TestBed.createComponent(ProfileEditorComponent);
    const store = TestBed.inject(ProfileStore);
    store.openProfileEditor(); f.detectChanges();
    return { f, store, editor: f.componentInstance as any };
  }

  it('reuses the prepared model and data on an untouched close/reopen', () => {
    const { f, store, editor } = fixture();
    const data = editor.profileEditorData, model = editor.profileEditorFlowModel;
    expect(data.profile.id).toBe('a');
    store.closeProfileEditor(); f.detectChanges();
    store.openProfileEditor(); f.detectChanges();
    expect(editor.profileEditorData).toBe(data);
    expect(editor.profileEditorFlowModel).toBe(model);
    expect(save).not.toHaveBeenCalled();
  });

  it('discards unsaved changes and uses the current canonical profile on reopening', () => {
    const { f, store, editor } = fixture();
    editor.onProfileDraftChange(profile('a', 'Unsaved'));
    store.closeProfileEditor(); f.detectChanges();
    store.openProfileEditor(); f.detectChanges();
    expect(editor.profileEditorData.profile.name).toBe('Anna');
    store.closeProfileEditor(); f.detectChanges();
    current.set(profile('a', 'Server update')); f.detectChanges();
    store.openProfileEditor(); f.detectChanges();
    expect(editor.profileEditorData.profile.name).toBe('Server update');
  });

  it('clears private state on logout and never reuses another user\'s form', () => {
    const { f, store, editor } = fixture();
    store.closeProfileEditor(); id.set(''); current.set(null); f.detectChanges();
    expect(editor.activeUser).toBeNull();
    expect(editor.profileEditorFlowModel).toBeNull();
    id.set('b'); current.set(profile('b', 'Bela')); store.openProfileEditor(); f.detectChanges();
    expect(editor.profileEditorData.profile.id).toBe('b');
    expect(editor.profileEditorData.profile.name).toBe('Bela');
  });

  it('keeps the same form, draft and scroll position across the image editor', async () => {
    // Use the real parent template: state-only tests cannot detect @if teardown.
    TestBed.overrideComponent(ProfileEditorComponent, { set: {
      imports: [FormsModule, FormFlowComponent, ImageEditorStub],
      schemas: [NO_ERRORS_SCHEMA]
    } });
    TestBed.overrideComponent(FormFlowComponent, { set: { template: '', imports: [] } });
    const { f, editor } = fixture(false);
    const form = f.debugElement.query(By.directive(FormFlowComponent)).componentInstance;
    const area = f.nativeElement.querySelector('.profile-editor-scroll-area');
    area.scrollTop = 123;
    editor.onProfileDraftChange(profile('a', 'Unsaved'));
    f.debugElement.query(By.css('app-header-card')).triggerEventHandler('edit');
    await f.whenStable();
    f.detectChanges();
    expect(editor.panel).toBe('image');
    expect(editor.isOpen()).toBe(true);
    expect(editor.activeUser?.id).toBe('a');
    expect(f.debugElement.query(By.directive(FormFlowComponent)).componentInstance).toBe(form);
    expect(f.nativeElement.querySelectorAll('app-popup').length).toBe(2);
    expect(f.nativeElement.querySelector('.profile-editor-wrap').hidden).toBe(false);
    expect(f.nativeElement.querySelector('.profile-editor-popup-content').hasAttribute('inert')).toBe(true);
    editor.onProfileImagesChange(['new-image']);
    editor.handleCloseAction(); f.changeDetectorRef.markForCheck();
    await f.whenStable(); f.detectChanges();
    expect(f.debugElement.query(By.directive(FormFlowComponent)).componentInstance).toBe(form);
    expect(f.nativeElement.querySelector('.profile-editor-wrap').hidden).toBe(false);
    expect(area.scrollTop).toBe(123);
    expect(editor.profileEditorData.profile.name).toBe('Unsaved');
    expect(editor.profileEditorData.profile.images).toEqual(['new-image']);
    expect(save).not.toHaveBeenCalled();
  });

  it('retains the server-confirmed saved profile for the next opening', async () => {
    const { f, store, editor } = fixture();
    editor.onProfileDraftChange(profile('a', 'Edited'));
    save.mockImplementation(async () => {
      const saved = profile('a', 'Confirmed'); current.set(saved); return saved.profile;
    });
    await editor.commitProfileForm(false);
    const prepared = editor.profileEditorFlowModel;
    store.closeProfileEditor(); f.detectChanges();
    store.openProfileEditor(); f.detectChanges();
    expect(editor.profileEditorData.profile.name).toBe('Confirmed');
    expect(editor.profileEditorFlowModel).toBe(prepared);
  });
});
