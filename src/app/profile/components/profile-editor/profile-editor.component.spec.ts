import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProfileEditorComponent } from './profile-editor.component';
import { ProfileExtDto } from '../../../shared/core/contracts/user.interface';
import { UsersService, ExplanationGuideService } from '../../../shared/core';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ProfileStore } from '../../../shared/ui/context/stores/profile.store';

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
    TestBed.overrideComponent(ProfileEditorComponent, { set: { template: '', imports: [] } });
  });
  afterEach(() => TestBed.resetTestingModule());
  function fixture() {
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
