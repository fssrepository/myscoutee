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
  UsersService
} from '../../../shared/core';
import { ProfileExtDto, UserDto } from '../../../shared/core/contracts/user.interface';
import {
  EditableImageCarouselComponent,
  HeaderCardComponent,
  type HeaderCardModel,
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
  ProfileHeaderCardConverter,
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
    HeaderCardComponent,
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
  protected readonly activeUserIsAdmin = this.appCtx.activeUserIsAdmin;
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly showProfileSaveRing = computed(() => this.isProfileSaving() || this.hasProfileSaveError());

  protected panel: ProfileEditorPanel = 'profile';
  protected profileEditorData = new ProfileExtDto();
  protected profileEditorFlowModel: FormFlowModel | null = null;
  protected profileCompletionPercent = 0;
  protected experienceFilter: ProfileContracts.ExperienceFilter = 'All';

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
    if (this.activeUserIsAdmin()) {
      return 'Admin profile';
    }
    switch (this.panel) {
      case 'experience':
        return 'Experience';
      default:
        return 'Profile';
    }
  }

  protected handleCloseAction(): void {
    if (this.panel !== 'profile') {
      this.panel = 'profile';
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

  protected onProfileImagesChange(imageUrls: readonly string[]): void {
    this.profileEditorData = {
      ...this.profileEditorData,
      profile: {
        ...this.profileEditorData.profile,
        images: [...imageUrls]
      }
    };
    this.refreshProfileEditorFlowModel();
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

  protected onProfileCompletionPercentChange(percent: number): void {
    this.profileCompletionPercent = Math.max(0, Math.min(100, Math.trunc(Number(percent) || 0)));
  }

  protected profileHeaderCardModel(): HeaderCardModel {
    const admin = this.activeUserIsAdmin();
    const profile = this.profileEditorData.profile;
    return ProfileHeaderCardConverter.convert(profile, {
      admin,
      age: this.profileEditorAge,
      completionPercent: this.profileCompletionPercent,
      showEdit: true,
      editAriaLabel: 'Open image editor'
    });
  }

  private loadProfileEditorState(user: UserDto): void {
    this.resetTransientUiState();
    this.profileCompletionPercent = Math.max(0, Math.min(100, Math.trunc(Number(user.completion) || 0)));
    this.profileEditorData = this.normalizeProfileEditorData({
      profile: this.cloneUser(user),
      experienceEntries: []
    });
    this.refreshProfileEditorFlowModel();
    this.panel = 'profile';
    void this.loadExperienceEntriesForUser(user.id);
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
        profileSize: this.activeUserIsAdmin() ? 'small' : 'big',
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
    this.profileEditorData = this.normalizeProfileEditorData(this.profileEditorData);
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

  private async commitProfileForm(showAlert: boolean): Promise<void> {
    if (!this.profileEditorData.profile.id) {
      return;
    }
    this.applyProfileEditorDataToEditorState();
    const request = this.normalizeProfileEditorData(this.profileEditorData);
    request.profile.completion = this.activeUserIsAdmin() ? 100 : this.profileCompletionPercent;
    this.profileEditorData = request;
    await this.usersService.saveUserProfileExt(request);
    if (showAlert) {
      this.confirmationDialogService.openInfo('Profile saved', {
        title: 'Profile updated',
        confirmTone: 'neutral'
      });
    }
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
  }
}
