
import { Component, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppContext, USER_FEEDBACK_SUBMIT_CONTEXT_KEY, UsersService } from '../../../shared/core';
import { NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-feedback-popup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './navigator-feedback-popup.component.html',
  styleUrl: './navigator-feedback-popup.component.scss'
})
export class NavigatorFeedbackPopupComponent implements OnDestroy {
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly appCtx = inject(AppContext);
  private readonly submitLoadState = this.appCtx.selectLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  private submitAbortController: AbortController | null = null;
  private submitRequestVersion = 0;

  protected readonly feedbackCategories = APP_STATIC_DATA.feedbackCategories;
  protected readonly feedbackDetailsMinLength = 8;
  protected readonly submitRingPerimeter = 100;
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
    this.appCtx.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  ngOnDestroy(): void {
    this.abortActiveSubmit();
    this.appCtx.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  protected closePopup(): void {
    this.abortActiveSubmit();
    this.navigatorService.closeSettingsPopup();
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

  protected clearSubmitStatus(): void {
    if (this.isSubmitBusy() || this.feedbackSubmitted) {
      return;
    }
    this.appCtx.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }

  protected async submitFeedback(): Promise<void> {
    const subject = this.feedbackForm.subject.trim();
    const details = this.feedbackForm.details.trim();
    if (!subject || details.length < this.feedbackDetailsMinLength || this.isSubmitting()) {
      return;
    }

    this.appCtx.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
    const requestVersion = ++this.submitRequestVersion;
    const abortController = new AbortController();
    this.submitAbortController = abortController;

    const response = await this.usersService.submitUserFeedback(
      {
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
    this.appCtx.resetLoadingState(USER_FEEDBACK_SUBMIT_CONTEXT_KEY);
  }
}
