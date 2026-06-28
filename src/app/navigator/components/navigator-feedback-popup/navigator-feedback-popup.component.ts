
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
  type AppMenuItemSelectEvent
} from '../../../shared/ui';
import {
  NavigatorStore
} from '../../../shared/ui/context/stores/navigator.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';

@Component({
  selector: 'app-navigator-feedback-popup',
  standalone: true,
  imports: [FormsModule, AppMenuComponent],
  templateUrl: './navigator-feedback-popup.component.html',
  styleUrl: './navigator-feedback-popup.component.scss'
})
export class NavigatorFeedbackPopupComponent implements OnDestroy {
  private readonly navigatorStore = inject(NavigatorStore);
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
    this.navigatorStore.closeSettingsPopup();
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

  protected feedbackSubmitMenuItems(): readonly AppMenuItem<string>[] {
    return [{
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
    }];
  }

  protected onFeedbackSubmitMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.id !== 'feedback-submit') {
      return;
    }
    void this.submitFeedback();
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

  private createInitialForm(): { category: string; subject: string; details: string } {
    return {
      category: this.feedbackCategories[0] ?? 'General',
      subject: '',
      details: ''
    };
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
