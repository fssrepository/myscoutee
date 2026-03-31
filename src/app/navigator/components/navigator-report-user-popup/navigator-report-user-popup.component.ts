
import { Component, OnDestroy, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppContext, USER_REPORT_USER_SUBMIT_CONTEXT_KEY, UsersService } from '../../../shared/core';
import { NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-report-user-popup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './navigator-report-user-popup.component.html',
  styleUrl: './navigator-report-user-popup.component.scss'
})
export class NavigatorReportUserPopupComponent implements OnDestroy {
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly appCtx = inject(AppContext);
  private readonly submitLoadState = this.appCtx.selectLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  private submitAbortController: AbortController | null = null;
  private submitRequestVersion = 0;

  protected readonly reportUserReasons = APP_STATIC_DATA.reportUserReasons;
  protected readonly reportUserHandleMinLength = 3;
  protected readonly reportUserDetailsMinLength = 12;
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
    this.hasSubmitError() ? (this.submitLoadState().error ?? 'Unable to submit report.') : ''
  );
  protected reportUserForm = this.createInitialForm();
  protected reportUserSubmitMessage = '';
  protected reportUserSubmitted = false;

  constructor() {
    this.appCtx.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }

  ngOnDestroy(): void {
    this.abortActiveSubmit();
    this.appCtx.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }

  protected closePopup(): void {
    this.abortActiveSubmit();
    this.navigatorService.closeSettingsPopup();
  }

  protected get reportUserHandleLength(): number {
    return this.reportUserForm.handle.trim().length;
  }

  protected get reportUserDetailsLength(): number {
    return this.reportUserForm.details.trim().length;
  }

  protected get reportUserHandleValid(): boolean {
    return this.reportUserHandleLength >= this.reportUserHandleMinLength;
  }

  protected get reportUserDetailsValid(): boolean {
    return this.reportUserDetailsLength >= this.reportUserDetailsMinLength;
  }

  protected canSubmitReportUser(): boolean {
    return !this.isSubmitBusy() && this.reportUserHandleValid && this.reportUserDetailsValid;
  }

  protected clearSubmitStatus(): void {
    if (this.isSubmitBusy() || this.reportUserSubmitted) {
      return;
    }
    this.appCtx.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }

  protected async submitReportUser(): Promise<void> {
    const target = this.reportUserForm.handle.trim();
    const details = this.reportUserForm.details.trim();
    if (!this.canSubmitReportUser() || this.isSubmitting()) {
      return;
    }

    this.appCtx.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
    const requestVersion = ++this.submitRequestVersion;
    const abortController = new AbortController();
    this.submitAbortController = abortController;

    const response = await this.usersService.submitReportUser(
      {
        handle: target,
        reason: this.reportUserForm.reason,
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

    this.reportUserSubmitMessage = response.message?.trim()
      ? response.message
      : `Report submitted successfully for ${target}. Our moderation team will review it.`;
    this.reportUserSubmitted = true;
  }

  private createInitialForm(): { handle: string; reason: string; details: string } {
    return {
      handle: '',
      reason: this.reportUserReasons[0] ?? 'Harassment',
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
    this.appCtx.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }
}
