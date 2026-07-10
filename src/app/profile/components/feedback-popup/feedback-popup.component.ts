
import {
  Component,
  OnDestroy,
  computed,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  USER_FEEDBACK_SUBMIT_CONTEXT_KEY,
  UsersService
} from '../../../shared/core';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  FormFlowComponent,
  type FormFlowModel
} from '../../../shared/ui';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';

interface FeedbackFormValue {
  category: string;
  subject: string;
  details: string;
}

type FeedbackActionId = 'feedback-cancel' | 'feedback-submit';

@Component({
  selector: 'app-profile-feedback-popup',
  standalone: true,
  imports: [FormsModule, AppMenuComponent, FormFlowComponent],
  templateUrl: './feedback-popup.component.html',
  styleUrl: './feedback-popup.component.scss'
})
export class ProfileFeedbackPopupComponent implements OnDestroy {
  private readonly profileStore = inject(ProfileStore);
  private readonly usersService = inject(UsersService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly submitLoadState = this.runtimeStore.selectLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  private submitAbortController: AbortController | null = null;
  private submitRequestVersion = 0;

  protected readonly feedbackCategories = APP_STATIC_DATA.feedbackCategories;
  protected readonly feedbackDetailsMinLength = 8;
  protected readonly isSubmitting = computed(() => this.submitLoadState().status === 'loading');
  protected readonly hasSubmitError = computed(() => {
    const status = this.submitLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly isSubmitSuccess = computed(() => this.submitLoadState().status === 'success');
  protected readonly isSubmitBusy = computed(() => this.isSubmitting() || this.isSubmitSuccess());
  protected readonly showSubmitRing = computed(() =>
    this.isSubmitting() || this.hasSubmitError() || this.isSubmitSuccess()
  );
  protected readonly submitErrorMessage = computed(() =>
    this.hasSubmitError() ? (this.submitLoadState().error ?? 'Unable to send feedback.') : ''
  );
  protected feedbackForm = this.createInitialForm();
  protected feedbackSubmitMessage = '';
  protected feedbackSubmitted = false;

  constructor() {
    this.runtimeStore.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  ngOnDestroy(): void {
    this.abortActiveSubmit();
    this.runtimeStore.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  protected closePopup(): void {
    this.abortActiveSubmit();
    this.profileStore.closeSettingsPopup();
  }

  protected get feedbackDetailsLength(): number {
    return this.feedbackForm.details.trim().length;
  }

  protected get feedbackDetailsRemaining(): number {
    return Math.max(0, this.feedbackDetailsMinLength - this.feedbackDetailsLength);
  }

  protected canSubmitFeedback(): boolean {
    return !this.isSubmitBusy() && !!this.feedbackForm.subject.trim() && this.feedbackDetailsRemaining === 0;
  }

  protected feedbackFlowModel(): FormFlowModel {
    const disabled = this.isSubmitBusy();
    return {
      title: 'Send Feedback',
      layout: 'grouped',
      tone: 'blue',
      header: false,
      allowMenuOverflow: true,
      summary: { enabled: false },
      completion: { controls: 'none' },
      save: null,
      steps: [{
        id: 'feedback',
        title: 'Feedback',
        chrome: 'none',
        controls: [
          {
            id: 'feedback-category',
            bind: 'category',
            kind: 'menu',
            layout: 'wide',
            label: 'Category',
            disabled,
            config: {
              kind: 'select',
              layout: 'list',
              title: 'Category',
              trigger: {
                label: this.feedbackForm.category,
                icon: 'category',
                palette: this.feedbackCategoryPalette(this.feedbackForm.category),
                layout: 'field',
                disabled,
                ariaLabel: 'Select feedback category'
              },
              items: this.feedbackCategories.map((category, index) => ({
                id: `feedback-category-${index}`,
                label: category,
                icon: this.feedbackCategoryIcon(category),
                kind: 'radio',
                value: category,
                active: category === this.feedbackForm.category,
                checked: category === this.feedbackForm.category,
                palette: this.feedbackCategoryPalette(category),
                surface: 'tinted',
                disabled
              }))
            }
          },
          {
            id: 'feedback-subject',
            bind: 'subject',
            kind: 'text',
            layout: 'wide',
            label: 'Subject',
            placeholder: 'Short summary',
            disabled
          },
          {
            id: 'feedback-details',
            bind: 'details',
            kind: 'textarea',
            layout: 'wide',
            label: 'Details',
            placeholder: 'Describe your feedback. Include steps if this is a bug.',
            rows: 4,
            required: true,
            minLength: this.feedbackDetailsMinLength,
            disabled
          }
        ]
      }]
    };
  }

  protected feedbackActionMenuItems(): readonly AppMenuItem<FeedbackActionId>[] {
    return [
      {
        id: 'feedback-cancel',
        label: 'Cancel',
        layout: 'action',
        palette: 'slate',
        ariaLabel: 'Cancel feedback'
      },
      {
        id: 'feedback-submit',
        label: 'Send feedback',
        layout: 'action',
        palette: this.hasSubmitError() ? 'danger' : this.isSubmitSuccess() ? 'success' : 'blue',
        disabled: !this.canSubmitFeedback(),
        ariaLabel: 'Send feedback',
        progress: this.showSubmitRing()
          ? {
              state: this.hasSubmitError() ? 'error' : this.isSubmitSuccess() ? 'success' : 'loading',
              shape: 'button'
            }
          : null
      }
    ];
  }

  protected onFeedbackFlowValueChange(value: unknown): void {
    const record = this.isRecord(value) ? value : {};
    const category = `${record['category'] ?? ''}`;
    this.feedbackForm = {
      category: this.feedbackCategories.includes(category)
        ? category
        : this.feedbackCategories[0] ?? 'General',
      subject: `${record['subject'] ?? ''}`,
      details: `${record['details'] ?? ''}`
    };
    this.clearSubmitStatus();
  }

  protected onFeedbackActionMenuSelect(event: AppMenuItemSelectEvent<FeedbackActionId>): void {
    if (event.id === 'feedback-cancel') {
      this.closePopup();
    } else if (event.id === 'feedback-submit') {
      void this.submitFeedback();
    }
  }

  protected clearSubmitStatus(): void {
    if (this.isSubmitBusy() || this.feedbackSubmitted) {
      return;
    }
    this.runtimeStore.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  protected async submitFeedback(): Promise<void> {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    const subject = this.feedbackForm.subject.trim();
    const details = this.feedbackForm.details.trim();
    if (!activeUserId || !subject || details.length < this.feedbackDetailsMinLength || this.isSubmitting()) {
      return;
    }

    this.runtimeStore.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
    const requestVersion = ++this.submitRequestVersion;
    const abortController = new AbortController();
    this.submitAbortController = abortController;

    const response = await this.usersService.submitUserFeedback(
      {
        userId: activeUserId,
        category: this.feedbackForm.category,
        subject,
        details
      },
      undefined,
      abortController.signal
    );

    if (this.submitAbortController === abortController) {
      this.submitAbortController = null;
    }
    if (requestVersion !== this.submitRequestVersion || abortController.signal.aborted || !response.submitted) {
      return;
    }

    this.feedbackSubmitMessage = response.message?.trim()
      ? response.message
      : `Feedback sent successfully in "${this.feedbackForm.category}". Thank you for helping improve MyScoutee.`;
    this.feedbackSubmitted = true;
  }

  private feedbackCategoryIcon(category: string): string {
    switch (category) {
      case 'Bug report':
        return 'bug_report';
      case 'Feature request':
        return 'lightbulb';
      case 'UX improvement':
        return 'touch_app';
      case 'Performance':
        return 'speed';
      default:
        return 'category';
    }
  }

  private feedbackCategoryPalette(category: string): AppMenuPalette {
    switch (category) {
      case 'Bug report':
        return 'danger';
      case 'Feature request':
        return 'amber';
      case 'UX improvement':
        return 'violet';
      case 'Performance':
        return 'green';
      default:
        return 'blue';
    }
  }

  private createInitialForm(): FeedbackFormValue {
    return {
      category: this.feedbackCategories[0] ?? 'General',
      subject: '',
      details: ''
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private abortActiveSubmit(): void {
    this.submitRequestVersion += 1;
    if (!this.submitAbortController) {
      return;
    }
    const controller = this.submitAbortController;
    this.submitAbortController = null;
    controller.abort();
    this.runtimeStore.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }
}
