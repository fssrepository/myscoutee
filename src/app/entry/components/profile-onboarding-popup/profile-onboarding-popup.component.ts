import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { ProfileExperienceManagerComponent } from '../../../shared/ui/components/profile-experience-manager';
import {
  FormFlowComponent,
  type FormFlowActionEvent,
  type FormFlowModel
} from '../../../shared/ui/components/form-flow';
import { I18nPipe } from '../../../shared/ui/pipes';
import {
  UsersService,
  type ProfileOnboardingDraft,
  type UserDto
} from '../../../shared/core';
import type {
  ExperienceEntry,
  ExperienceFilter
} from '../../../shared/core/contracts/profile.interface';
import {
  ProfileOnboardingDraftConverter,
  ProfileOnboardingFormFlowConverter,
  type ProfileOnboardingFormFlowMenuContext
} from '../../../shared/ui/converters/profile-onboarding-form-flow.converter';

type OnboardingExperienceSelectorType = Extract<ExperienceEntry['type'], 'Workspace' | 'School'>;

@Component({
  selector: 'app-profile-onboarding-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    FormFlowComponent,
    ProfileExperienceManagerComponent,
    I18nPipe
  ],
  templateUrl: './profile-onboarding-popup.component.html',
  styleUrl: './profile-onboarding-popup.component.scss'
})
export class ProfileOnboardingPopupComponent implements OnChanges, OnDestroy {
  private static readonly MIN_REQUIRED_IMAGES = 3;

  @Input() open = false;
  @Input() user: UserDto | null = null;
  @Input() mobile = false;
  @Input() title = 'profile.setup';
  @Input() message = '';

  @Output() readonly completed = new EventEmitter<UserDto>();
  @Output() readonly dismissed = new EventEmitter<void>();

  private readonly usersService = inject(UsersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private documentScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyOverscrollBehavior = '';
  private previousDocumentOverflow = '';
  private previousDocumentOverscrollBehavior = '';

  protected draft: ProfileOnboardingDraft | null = null;
  protected onboardingFlowModel: FormFlowModel | null = null;
  protected saving = false;
  protected saveError = '';
  protected experienceManagerOpen = false;
  protected experienceManagerFilter: ExperienceFilter = 'All';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncDocumentScrollLock();
    }
    if (!changes['open'] && !changes['user']) {
      return;
    }
    if (!this.open || !this.user) {
      this.resetPopupState();
      return;
    }
    const nextUserId = this.user.id.trim();
    if (this.draft?.userId === nextUserId) {
      return;
    }
    this.draft = ProfileOnboardingDraftConverter.convert(this.user);
    this.saveError = '';
    this.saving = false;
    this.experienceManagerOpen = false;
    this.experienceManagerFilter = 'All';
    this.refreshOnboardingFlowModel();
  }

  ngOnDestroy(): void {
    this.unlockDocumentScroll();
  }

  protected onOnboardingFlowSave(): void {
    if (!this.draft || this.saving) {
      return;
    }
    this.normalizeDraft();
    void this.saveAndComplete();
  }

  protected onOnboardingFlowAction(event: FormFlowActionEvent): void {
    const context = event.context as ProfileOnboardingFormFlowMenuContext | undefined;
    if (context?.menu === 'experienceSelector') {
      this.openExperienceManager(context.value);
    }
  }

  protected requestDismiss(): void {
    if (this.saving) {
      return;
    }
    this.dismissed.emit();
  }

  protected closeExperienceManager(): void {
    this.experienceManagerOpen = false;
  }

  protected experienceManagerTitle(): string {
    if (this.experienceManagerFilter === 'Workspace') {
      return 'profile.experience.workplace';
    }
    if (this.experienceManagerFilter === 'School') {
      return 'profile.experience.school';
    }
    return 'Experience';
  }

  protected onExperienceManagerEntriesChange(entries: readonly ExperienceEntry[]): void {
    if (!this.draft) {
      return;
    }
    this.draft.data = {
      ...this.draft.data,
      experienceEntries: entries.map(entry => ({ ...entry }))
    };
    this.refreshOnboardingFlowModel();
    this.cdr.markForCheck();
  }

  private async saveAndComplete(): Promise<void> {
    if (!this.user || !this.draft || this.requiredMissingLabels().length > 0 || this.saving) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    let completionEmitted = false;
    try {
      const savedUser = await this.usersService.saveUserProfileExt(this.draft.data);
      if (!savedUser) {
        throw new Error('Profile save returned no user.');
      }
      completionEmitted = true;
      this.completed.emit(savedUser);
    } catch {
      this.saveError = 'Profile could not be saved. Please check the required fields and try again.';
    } finally {
      if (!completionEmitted) {
        this.saving = false;
      }
    }
  }

  private requiredMissingLabels(): string[] {
    if (!this.draft) {
      return [];
    }
    const labels: string[] = [];
    const profile = this.draft.data.profile;
    if (!profile.name.trim()) {
      labels.push('Name');
    }
    if (!profile.birthday.trim()) {
      labels.push('Birthday');
    }
    if (!profile.city.trim()) {
      labels.push('City');
    }
    if ((Number.parseInt(`${profile.height ?? ''}`.replace(/[^0-9]/g, ''), 10) || 0) <= 0) {
      labels.push('Height');
    }
    if (!profile.physique.trim()) {
      labels.push('Physique');
    }
    if (profile.languages.length === 0) {
      labels.push('Language');
    }
    if ((profile.images ?? []).length < ProfileOnboardingPopupComponent.MIN_REQUIRED_IMAGES) {
      labels.push('3 photos');
    }
    return labels;
  }

  private normalizeDraft(): void {
    if (!this.draft) {
      return;
    }
    this.draft = ProfileOnboardingDraftConverter.convert(this.draft);
    this.refreshOnboardingFlowModel();
  }

  private resetPopupState(): void {
    this.draft = null;
    this.onboardingFlowModel = null;
    this.saveError = '';
    this.saving = false;
    this.experienceManagerOpen = false;
    this.experienceManagerFilter = 'All';
  }

  private openExperienceManager(type: OnboardingExperienceSelectorType): void {
    if (this.saving) {
      return;
    }
    this.experienceManagerFilter = type;
    this.experienceManagerOpen = true;
  }

  private refreshOnboardingFlowModel(): void {
    this.onboardingFlowModel = this.draft
      ? ProfileOnboardingFormFlowConverter.convert(this.draft, {
          title: this.title,
          subtitle: this.message,
          userId: this.user?.id ?? ''
        })
      : null;
  }

  private syncDocumentScrollLock(): void {
    if (this.open) {
      this.lockDocumentScroll();
      return;
    }
    this.unlockDocumentScroll();
  }

  private lockDocumentScroll(): void {
    if (this.documentScrollLocked) {
      return;
    }
    const body = this.document.body;
    const documentElement = this.document.documentElement;
    if (!body || !documentElement) {
      return;
    }
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    this.previousDocumentOverflow = documentElement.style.overflow;
    this.previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    this.documentScrollLocked = true;
  }

  private unlockDocumentScroll(): void {
    if (!this.documentScrollLocked) {
      return;
    }
    const body = this.document.body;
    const documentElement = this.document.documentElement;
    if (body) {
      body.style.overflow = this.previousBodyOverflow;
      body.style.overscrollBehavior = this.previousBodyOverscrollBehavior;
    }
    if (documentElement) {
      documentElement.style.overflow = this.previousDocumentOverflow;
      documentElement.style.overscrollBehavior = this.previousDocumentOverscrollBehavior;
    }
    this.documentScrollLocked = false;
  }
}
