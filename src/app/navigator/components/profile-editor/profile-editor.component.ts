import { CommonModule } from '@angular/common';
import { Component, HostListener, ViewChild, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type * as AppTypes from '../../../shared/core/base/models';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AppContext } from '../../../shared/ui';
import {
  USER_PROFILE_SAVE_CONTEXT_KEY,
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
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '../../../shared/ui/components/menu';
import {
  FormFlowComponent,
  type FormFlowActionEvent,
  type FormFlowDraft,
  type FormFlowModel
} from '../../../shared/ui/components/form/flow';
import {
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
  private readonly menuDispatcher = inject(AppMenuDispatcher);
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private lastLoadedUserId = '';

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
      const activeProfileExt = this.appCtx.activeUserProfileExt();
      const activeUser = activeProfileExt?.profile ?? this.appCtx.activeUserProfile();
      const activeUserId = activeUser?.id.trim() ?? '';

      if (!isOpen) {
        this.lastLoadedUserId = '';
        this.resetTransientUiState();
        return;
      }

      if (!activeUser || this.lastLoadedUserId === activeUserId) {
        return;
      }

      this.lastLoadedUserId = activeUserId;
      this.loadProfileEditorState(activeUserId, activeProfileExt);
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

  protected profileHeaderStatusMenuItems(): readonly AppMenuItem<ProfileEditorMenuId>[] {
    const status = this.profileEditorData.profile.profileStatus ?? 'public';
    return [{
      id: 'profile-status-trigger',
      label: status,
      icon: this.profileStatusIcon(status),
      kind: 'select-trigger',
      layout: 'pill',
      palette: this.profileStatusPalette(status),
      ariaLabel: 'Open profile status selector',
      items: this.profileStatusMenuItems()
    }];
  }

  private profileStatusMenuItems(): readonly AppMenuItem<ProfileEditorMenuId>[] {
    return APP_STATIC_DATA.profileStatusOptions.map(option => ({
      id: `profile-status-${option.value}`,
      label: option.value,
      icon: option.icon,
      kind: 'radio',
      value: option.value,
      palette: this.profileStatusPalette(option.value),
      surface: 'tinted'
    }));
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

  private profileStatusIcon(status: AppConstants.ProfileStatus): string {
    return APP_STATIC_DATA.profileStatusOptions.find(option => option.value === status)?.icon
      ?? (status === 'blocked' ? 'block' : status === 'deleted' ? 'delete' : 'public');
  }

  private profileStatusPalette(status: AppConstants.ProfileStatus): AppMenuPalette {
    switch (status) {
      case 'public':
        return 'green';
      case 'friends only':
        return 'blue';
      case 'host only':
        return 'brown';
      case 'inactive':
        return 'muted';
      case 'blocked':
      case 'deleted':
        return 'red';
      default:
        return 'neutral';
    }
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

  private loadProfileEditorState(userId: string, activeProfileExt: ProfileExtDto | null): void {
    this.resetTransientUiState();
    const normalizedUserId = userId.trim();
    if (!this.isOpen() || this.lastLoadedUserId !== normalizedUserId) {
      return;
    }
    if (!activeProfileExt) {
      return;
    }
    this.profileCompletionPercent = Math.max(0, Math.min(100, Math.trunc(Number(activeProfileExt.profile.completion) || 0)));
    this.profileEditorData = activeProfileExt;
    this.refreshProfileEditorFlowModel();
    this.panel = 'profile';
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

  private async commitProfileForm(showAlert: boolean): Promise<void> {
    if (!this.profileEditorData.profile.id) {
      return;
    }
    await this.usersService.saveUserProfileExt(this.profileEditorData);
    if (showAlert) {
      this.confirmationDialogService.openInfo('Profile saved', {
        title: 'Profile updated',
        confirmTone: 'neutral'
      });
    }
  }

  private resetTransientUiState(): void {
    this.menuDispatcher.close();
    this.panel = 'profile';
  }
}
