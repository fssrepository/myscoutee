import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, ViewChild, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import { AppContext } from '../../../shared/ui';
import {
  USER_PROFILE_SAVE_CONTEXT_KEY,
  UserExperiencesService,
  UsersService,
  type UserDto
} from '../../../shared/core';
import type { ProfileExtDto } from '../../../shared/core/contracts/user.interface';
import {
  EditableImageCarouselComponent,
  ProfileExperienceManagerComponent
} from '../../../shared/ui';
import {
  AppMenuComponent,
  AppMenuDispatcher,
  AppMenuOutletComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui/components/menu';
import {
  FormFlowComponent,
  type FormFlowActionEvent,
  type FormFlowDraft,
  type FormFlowModel
} from '../../../shared/ui/components/form-flow';
import {
  ProfileFormFlowDataConverter,
  ProfileFormFlowConverter,
  type ProfileFormFlowMenuContext
} from '../../../shared/ui/converters';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { NavigatorService } from '../../navigator.service';
import type * as ProfileContracts from '../../../shared/core/contracts/profile.interface';

import type * as AppConstants from '../../../shared/core/common/constants';
type ProfileEditorPanel = 'profile' | 'image' | 'experience';
type ProfileEditorMenuId = string;

type ProfileEditorMenuContext = { kind: 'profileSave' };

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    AppMenuComponent,
    AppMenuOutletComponent,
    FormFlowComponent,
    EditableImageCarouselComponent,
    ProfileExperienceManagerComponent
  ],
  providers: [
    AppMenuDispatcher
  ],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.scss'
})
export class ProfileEditorComponent {
  @ViewChild(ProfileExperienceManagerComponent) private experienceManager?: ProfileExperienceManagerComponent;

  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly appCtx = inject(AppContext);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly menuDispatcher = inject(AppMenuDispatcher);
  private readonly navigatorService = inject(NavigatorService);
  private readonly userExperiencesService = inject(UserExperiencesService);
  private readonly usersService = inject(UsersService);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private lastLoadedUserId = '';
  private experienceEntriesLoadToken = 0;

  protected readonly isOpen = this.navigatorService.profileEditorOpen;
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly showProfileSaveRing = computed(() => this.isProfileSaving() || this.hasProfileSaveError());

  protected panel: ProfileEditorPanel = 'profile';
  protected profileEditorData: ProfileExtDto = this.createEmptyProfileEditorData();
  protected profileEditorFlowModel: FormFlowModel | null = null;
  protected imageSlots: Array<string | null> = this.createEmptyImageSlots();
  protected profileCompletionPercent = 0;
  protected experienceFilter: ProfileContracts.ExperienceFilter = 'All';
  protected experienceManagerOverlayOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.navigatorService.profileEditorOpen();
      const activeUser = this.appCtx.activeUserProfile();
      const activeUserId = activeUser?.id ?? '';

      if (!isOpen) {
        this.lastLoadedUserId = '';
        this.resetTransientUiState();
        return;
      }

      if (!activeUser || this.lastLoadedUserId === activeUserId) {
        return;
      }

      this.lastLoadedUserId = activeUserId;
      this.loadProfileEditorState(activeUser);
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onWindowEscape(event: Event): void {
    if (!this.isOpen()) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.stopPropagation();
    void this.handleCloseAction();
  }

  protected get activeUser(): UserDto | null {
    return this.profileEditorData.profile.id ? this.profileEditorData.profile : null;
  }

  protected get featuredImagePreview(): string | null {
    return this.imageSlots[0] ?? null;
  }

  protected get imageStackSlots(): number[] {
    return this.imageSlots
      .map((slot, index) => (slot ? index : -1))
      .filter(index => index >= 0);
  }

  protected get profileImageUrls(): string[] {
    return this.collectPersistedProfileImages();
  }

  protected set profileImageUrls(imageUrls: string[]) {
    this.applyProfileImageUrls(imageUrls);
  }

  protected get profileEditorAge(): number {
    const profile = this.profileEditorData.profile;
    return AppUtils.ageFromIsoDate(profile.birthday, profile.age);
  }

  protected onProfileEditorFlowAction(event: FormFlowActionEvent): void {
    this.handleProfileFormFlowMenuContext(event.context as ProfileFormFlowMenuContext | undefined);
  }

  private handleProfileFormFlowMenuContext(context: ProfileFormFlowMenuContext | undefined): void {
    if (context?.menu === 'experienceSelector') {
      this.openExperienceSelector(context.value);
      return;
    }
    if (context?.menu === 'privacy') {
      this.setProfileDetailPrivacy(context.key, context.value);
      this.refreshProfileEditorFlowModel();
      return;
    }
  }

  protected popupTitle(): string {
    if (this.panel === 'image') {
      return 'Images';
    }
    if (this.isAdminProfile()) {
      return 'Admin profile';
    }
    switch (this.panel) {
      case 'experience':
        return 'Experience';
      default:
        return 'Profile';
    }
  }

  protected isAdminProfile(): boolean {
    const user = this.profileEditorData.profile;
    return Boolean(user && (user.hostTier === 'Admin' || user.statusText === 'Admin workspace' || user.id.startsWith('admin-')));
  }

  protected async handleCloseAction(): Promise<void> {
    if (this.panel === 'experience' && this.experienceManager?.closeActiveOverlay()) {
      return;
    }
    if (this.panel !== 'profile') {
      this.panel = 'profile';
      this.experienceManagerOverlayOpen = false;
      return;
    }
    this.navigatorService.closeProfileEditor();
    this.resetTransientUiState();
  }

  private async saveProfileFromHeader(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.panel !== 'profile' || this.isProfileSaving()) {
      return;
    }
    this.applyProfileEditorDataToEditorState();
    await this.commitProfileForm(false);
    this.navigatorService.closeProfileEditor();
    this.resetTransientUiState();
  }

  protected onBackdropClose(): void {
    void this.handleCloseAction();
  }

  protected openImageEditor(): void {
    this.panel = 'image';
  }

  protected openExperienceSelector(filter: ProfileContracts.ExperienceFilter = 'All'): void {
    this.experienceFilter = filter;
    this.experienceManager?.setFilter(filter);
    this.panel = 'experience';
  }

  private applyProfileImageUrls(imageUrls: string[]): void {
    const slots = this.createEmptyImageSlots();
    imageUrls
      .map(imageUrl => `${imageUrl ?? ''}`.trim())
      .filter(Boolean)
      .slice(0, slots.length)
      .forEach((imageUrl, index) => {
        slots[index] = imageUrl;
      });
    this.imageSlots = slots;
    this.profileEditorData = {
      ...this.profileEditorData,
      profile: {
        ...this.profileEditorData.profile,
        images: slots
          .map(image => image?.trim() ?? '')
          .filter(Boolean)
      }
    };
    this.refreshProfileEditorFlowModel();
    this.persistActiveUserImageSlots();
  }

  protected profileHeaderActionMenuItems(): readonly AppMenuItem<ProfileEditorMenuId, ProfileEditorMenuContext>[] {
    return [{
      id: 'profile-save',
      icon: 'done',
      kind: 'action',
      palette: 'green',
      disabled: () => this.isProfileSaving(),
      progress: {
        state: () => this.showProfileSaveRing()
          ? this.hasProfileSaveError() ? 'error' : 'loading'
          : null,
        shape: 'circle'
      },
      ariaLabel: 'Save profile',
      context: { kind: 'profileSave' }
    }];
  }

  protected onProfileEditorMenuSelect(
    event: AppMenuItemSelectEvent<ProfileEditorMenuId, ProfileEditorMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }

    if (context.kind === 'profileSave') {
      void this.saveProfileFromHeader(event.sourceEvent);
    }
  }

  protected onProfileEditorDispatchedMenuSelect(
    event: AppMenuItemSelectEvent<ProfileEditorMenuId, unknown>
  ): void {
    const context = event.context as ProfileEditorMenuContext | ProfileFormFlowMenuContext | undefined;
    if ((context as ProfileEditorMenuContext | undefined)?.kind === 'profileSave') {
      this.onProfileEditorMenuSelect(event as AppMenuItemSelectEvent<ProfileEditorMenuId, ProfileEditorMenuContext>);
      return;
    }
    this.handleProfileFormFlowMenuContext(context as ProfileFormFlowMenuContext | undefined);
  }

  protected onExperienceEntriesChange(entries: readonly ProfileContracts.ExperienceEntry[]): void {
    this.setExperienceEntries(entries);
  }

  protected onExperienceOverlayStateChange(open: boolean): void {
    this.experienceManagerOverlayOpen = open;
  }

  protected onProfileCompletionPercentChange(percent: number): void {
    this.profileCompletionPercent = Math.max(0, Math.min(100, Math.trunc(Number(percent) || 0)));
  }

  protected profileStatusClass(value: AppConstants.ProfileStatus = this.profileEditorData.profile.profileStatus): string {
    switch (value) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      default:
        return 'status-inactive';
    }
  }

  protected completionBadgeStyle(value: number): Record<string, string> {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const hue = Math.round((clamped / 100) * 120);
    return {
      background: `hsl(${hue}, 82%, 84%)`,
      borderColor: `hsl(${hue}, 70%, 58%)`,
      color: `hsl(${hue}, 74%, 24%)`
    };
  }

  private loadProfileEditorState(user: UserDto): void {
    this.resetTransientUiState();
    this.profileCompletionPercent = Math.max(0, Math.min(100, Math.trunc(Number(user.completion) || 0)));
    this.imageSlots = this.resolveUserImageSlots(user);
    this.profileEditorData = this.normalizeProfileEditorData({
      profile: this.cloneUser(user),
      experienceEntries: []
    });
    this.refreshProfileEditorFlowModel();
    this.panel = 'profile';
    void this.loadExperienceEntriesForUser(user.id);
  }

  private createEmptyProfileEditorData(): ProfileExtDto {
    return {
      profile: this.createEmptyProfileEditorUser(),
      experienceEntries: []
    };
  }

  private createEmptyProfileEditorUser(): UserDto {
    return {
      id: '',
      name: '',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: '',
      gender: 'man',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileDetails: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0
      }
    };
  }

  private normalizeProfileEditorData(value: ProfileExtDto): ProfileExtDto {
    return ProfileFormFlowDataConverter.convert(this.profileEditorDraft(value)).data;
  }

  private profileEditorDraft(data: ProfileExtDto): FormFlowDraft<ProfileExtDto> {
    return {
      version: 1,
      userId: data.profile.id.trim(),
      currentStepId: 'basics',
      updatedAtIso: new Date().toISOString(),
      completedStepIds: [],
      skippedStepIds: [],
      data
    };
  }

  private profileEditorPrivacyValues(): Record<string, AppConstants.DetailPrivacy> {
    const values: Record<string, AppConstants.DetailPrivacy> = {};
    for (const group of this.profileEditorData.profile.profileDetails ?? []) {
      for (const row of group.rows) {
        values[row.labelKey] = row.privacy;
      }
    }
    return values;
  }

  private refreshProfileEditorFlowModel(): void {
    this.profileEditorFlowModel = ProfileFormFlowConverter.convert(
      this.profileEditorDraft(this.profileEditorData),
      {
        title: 'Profile',
        subtitle: '',
        userId: this.profileEditorData.profile.id,
        layout: 'grouped',
        imageEditor: 'external',
        privacy: {
          values: this.profileEditorPrivacyValues()
        },
        showHeader: false,
        showSave: false
      }
    );
  }

  private applyProfileEditorDataToEditorState(): void {
    const data = this.normalizeProfileEditorData({
      ...this.profileEditorData,
      profile: {
        ...this.profileEditorData.profile,
        images: this.imageSlots
          .map(image => image?.trim() ?? '')
          .filter(Boolean)
      }
    });
    this.profileEditorData = data;
    const profile = data.profile;
    const nextSlots = this.createEmptyImageSlots();
    (profile.images ?? [])
      .map(image => image.trim())
      .filter(Boolean)
      .slice(0, nextSlots.length)
      .forEach((image, index) => {
        nextSlots[index] = image;
      });
    this.imageSlots = nextSlots;
  }

  private createEmptyImageSlots(): Array<string | null> {
    return Array.from({ length: 8 }, () => null);
  }

  private resolveUserImageSlots(user: UserDto): Array<string | null> {
    const slots = this.createEmptyImageSlots();
    const explicitImages = (user.images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0)
      .slice(0, 8);
    explicitImages.forEach((url, index) => {
      slots[index] = url;
    });
    return slots;
  }


  private profileDetailRowByKey(labelKey: string): ProfileContracts.ProfileDetailFormRow | null {
    const target = AppUtils.normalizeText(labelKey);
    for (const group of this.profileEditorData.profile.profileDetails ?? []) {
      for (const row of group.rows) {
        if (AppUtils.normalizeText(row.labelKey) === target) {
          return row;
        }
      }
    }
    return null;
  }

  private setProfileDetailPrivacy(labelKey: string, value: AppConstants.DetailPrivacy): void {
    const row = this.profileDetailRowByKey(labelKey);
    if (!row) {
      return;
    }
    row.privacy = value;
    this.profileEditorData = {
      ...this.profileEditorData,
      profile: {
        ...this.profileEditorData.profile,
        profileDetails: [...(this.profileEditorData.profile.profileDetails ?? [])]
      }
    };
    this.refreshProfileEditorFlowModel();
  }

  private setExperienceEntries(entries: readonly ProfileContracts.ExperienceEntry[]): void {
    const nextEntries = [...entries];
    this.profileEditorData = {
      ...this.profileEditorData,
      experienceEntries: nextEntries
    };
    this.refreshProfileEditorFlowModel();
  }

  private async loadExperienceEntriesForUser(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      this.setExperienceEntries([]);
      return;
    }

    const requestToken = ++this.experienceEntriesLoadToken;
    try {
      const loadedEntries = await this.userExperiencesService.loadUserExperiences(normalizedUserId);
      if (requestToken !== this.experienceEntriesLoadToken || this.profileEditorData.profile.id !== normalizedUserId) {
        return;
      }
      this.setExperienceEntries(loadedEntries);
      this.cdr.markForCheck();
    } catch {
      if (requestToken !== this.experienceEntriesLoadToken || this.profileEditorData.profile.id !== normalizedUserId) {
        return;
      }
      this.cdr.markForCheck();
    }
  }

  private persistActiveUserImageSlots(): void {
    this.syncActiveUserImageSlotsState();
    if (this.profileEditorData.profile.id) {
      void this.usersService.saveUserProfileExt(this.normalizeProfileEditorData(this.profileEditorData));
    }
  }

  private collectPersistedProfileImages(existingImages: readonly string[] = []): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();
    const pushIfValid = (value: string | null | undefined): void => {
      const normalized = value?.trim() ?? '';
      if (!normalized || seen.has(normalized)) {
        return;
      }
      merged.push(normalized);
      seen.add(normalized);
    };
    for (const image of existingImages) {
      pushIfValid(image);
    }
    for (const slot of this.imageSlots) {
      pushIfValid(slot);
    }
    return merged;
  }

  private syncActiveUserImageSlotsState(preserveExisting = false): void {
    if (!this.profileEditorData.profile.id) {
      return;
    }
    const user = this.cloneUser(this.profileEditorData.profile);
    const previousImages = [...(user.images ?? [])];
    const nextImages = this.collectPersistedProfileImages();
    if (!preserveExisting) {
      user.images = nextImages;
    } else {
      const merged: string[] = [];
      const pushed = new Set<string>();
      for (const image of previousImages) {
        const normalized = image?.trim() ?? '';
        if (!normalized) {
          continue;
        }
        merged.push(normalized);
        pushed.add(normalized);
      }
      for (const image of nextImages) {
        const normalized = image?.trim() ?? '';
        if (!normalized || pushed.has(normalized)) {
          continue;
        }
        merged.push(normalized);
        pushed.add(normalized);
      }
      user.images = merged;
    }
    user.completion = this.profileCompletionPercent;
    this.profileEditorData = {
      ...this.profileEditorData,
      profile: user
    };
    this.pushProfileUserToContextAndLegacyMirror(user);
  }

  private async commitProfileForm(showAlert: boolean): Promise<void> {
    if (!this.profileEditorData.profile.id) {
      return;
    }
    this.applyProfileEditorDataToEditorState();
    const request = this.normalizeProfileEditorData(this.profileEditorData);
    request.profile.completion = this.isAdminProfile() ? 100 : this.profileCompletionPercent;
    this.profileEditorData = request;
    this.pushProfileUserToContextAndLegacyMirror(request.profile);
    await this.usersService.saveUserProfileExt(request);
    if (showAlert) {
      this.confirmationDialogService.openInfo('Profile saved', {
        title: 'Profile updated',
        confirmTone: 'neutral'
      });
    }
  }

  private pushProfileUserToContextAndLegacyMirror(user: UserDto): void {
    const normalized = this.cloneUser(user);
    this.profileEditorData = {
      ...this.profileEditorData,
      profile: normalized
    };
    this.appCtx.setUserProfile(normalized);
    this.navigatorService.syncHydratedUser(this.cloneUser(normalized));
  }

  private cloneUser(user: UserDto): UserDto {
    return {
      ...user,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      profileDetails: user.profileDetails ? this.cloneProfileDetailsForm(user.profileDetails) : undefined,
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0,
        cars: user.activities?.cars ?? 0,
        accommodation: user.activities?.accommodation ?? 0,
        supplies: user.activities?.supplies ?? 0,
        tickets: user.activities?.tickets ?? 0,
        contacts: user.activities?.contacts ?? 0,
        feedback: user.activities?.feedback ?? 0
      },
      impressions: user.impressions
        ? {
            host: user.impressions.host ? { ...user.impressions.host } : undefined,
            member: user.impressions.member ? { ...user.impressions.member } : undefined
          }
        : undefined
    };
  }

  private cloneProfileDetailsForm(groups: ProfileContracts.ProfileDetailFormGroup[]): ProfileContracts.ProfileDetailFormGroup[] {
    return groups.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        labelKey: row.labelKey,
        value: row.value,
        privacy: row.privacy,
        options: [...row.options]
      }))
    }));
  }

  private resetTransientUiState(): void {
    this.menuDispatcher.close();
    this.panel = 'profile';
    this.experienceManagerOverlayOpen = false;
  }
}
