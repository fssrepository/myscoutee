
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  USER_REPORT_USER_SUBMIT_CONTEXT_KEY,
  UsersService
} from '../../../shared/core';
import {
  AppMenuComponent,
  I18nPipe,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  FormFlowComponent,
  type FormFlowControlModel,
  type FormFlowModel
} from '../../../shared/ui';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';

interface ReportUserFormValue {
  handle: string;
  contextSummary: string;
  reason: string;
  details: string;
}

type ReportUserActionId = 'report-user-cancel' | 'report-user-submit';

@Component({
  selector: 'app-profile-report-user-popup',
  standalone: true,
  imports: [FormsModule, AppMenuComponent, FormFlowComponent, I18nPipe],
  templateUrl: './report-user-popup.component.html',
  styleUrl: './report-user-popup.component.scss'
})
export class ProfileReportUserPopupComponent implements OnDestroy {
  private readonly profileStore = inject(ProfileStore);
  private readonly usersService = inject(UsersService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly submitLoadState = this.runtimeStore.selectLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  private lastContextKey = '';
  private submitAbortController: AbortController | null = null;
  private submitRequestVersion = 0;

  protected readonly reportUserReasons = APP_STATIC_DATA.reportUserReasons;
  protected readonly reportUserHandleMinLength = 3;
  protected readonly reportUserDetailsMinLength = 12;
  protected readonly reportUserContext = this.profileStore.reportUserContext;
  protected readonly isContextualReport = computed(() => {
    const context = this.reportUserContext();
    return !!context?.targetUserId?.trim() && !!context?.eventId?.trim();
  });
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
    this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
    effect(() => {
      const context = this.reportUserContext();
      const contextKey = [
        context?.targetUserId?.trim() ?? '',
        context?.memberEntryId?.trim() ?? '',
        context?.eventId?.trim() ?? '',
        context?.eventTitle?.trim() ?? '',
        context?.eventStartAtIso?.trim() ?? '',
        context?.eventTimeframe?.trim() ?? '',
        context?.sourceType?.trim() ?? '',
        context?.sourceId?.trim() ?? '',
        context?.chatId?.trim() ?? '',
        context?.messageId?.trim() ?? ''
      ].join('|');
      if (contextKey === this.lastContextKey) {
        return;
      }
      this.lastContextKey = contextKey;
      this.abortActiveSubmit();
      this.reportUserForm = this.createInitialForm();
      this.reportUserSubmitMessage = '';
      this.reportUserSubmitted = false;
      this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
    });
  }

  ngOnDestroy(): void {
    this.abortActiveSubmit();
    this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }

  protected closePopup(): void {
    this.abortActiveSubmit();
    this.profileStore.closeSettingsPopup();
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
    return this.isContextualReport() && !this.isSubmitBusy() && this.reportUserHandleValid && this.reportUserDetailsValid;
  }

  protected reportUserFlowModel(): FormFlowModel {
    const disabled = this.isSubmitBusy();
    const controls: FormFlowControlModel[] = [
      {
        id: 'report-user-handle',
        bind: 'handle',
        kind: 'text',
        layout: 'wide',
        label: 'User',
        placeholder: 'Selected member',
        required: true,
        minLength: this.reportUserHandleMinLength,
        readOnly: this.isContextualReport(),
        disabled
      }
    ];
    if (this.isContextualReport()) {
      controls.push({
        id: 'report-user-context',
        bind: 'contextSummary',
        kind: 'textarea',
        layout: 'wide',
        label: 'Event context',
        rows: 3,
        readOnly: true,
        disabled
      });
    }
    controls.push(
      {
        id: 'report-user-reason',
        bind: 'reason',
        kind: 'menu',
        layout: 'wide',
        label: 'Reason',
        disabled,
        config: {
          kind: 'select',
          layout: 'list',
          title: 'Reason',
          trigger: {
            label: this.reportUserForm.reason,
            icon: this.reportUserReasonIcon(this.reportUserForm.reason),
            palette: this.reportUserReasonPalette(this.reportUserForm.reason),
            layout: 'field',
            disabled,
            ariaLabel: 'Select report reason'
          },
          items: this.reportUserReasons.map((reason, index) => ({
            id: `report-user-reason-${index}`,
            label: reason,
            icon: this.reportUserReasonIcon(reason),
            kind: 'radio',
            value: reason,
            active: reason === this.reportUserForm.reason,
            checked: reason === this.reportUserForm.reason,
            palette: this.reportUserReasonPalette(reason),
            surface: 'tinted',
            disabled
          }))
        }
      },
      {
        id: 'report-user-details',
        bind: 'details',
        kind: 'textarea',
        layout: 'wide',
        label: 'Details',
        placeholder: 'Add short details about what happened and why you are reporting this member.',
        rows: 4,
        required: true,
        minLength: this.reportUserDetailsMinLength,
        disabled
      }
    );
    return {
      title: 'Report User',
      layout: 'grouped',
      tone: 'orange',
      header: false,
      allowMenuOverflow: true,
      summary: { enabled: false },
      completion: { controls: 'none' },
      save: null,
      steps: [{
        id: 'report-user',
        title: 'Report User',
        chrome: 'none',
        controls
      }]
    };
  }

  protected reportUserActionMenuItems(): readonly AppMenuItem<ReportUserActionId>[] {
    return [
      {
        id: 'report-user-cancel',
        label: 'Cancel',
        layout: 'action',
        palette: 'slate',
        ariaLabel: 'Cancel report'
      },
      {
        id: 'report-user-submit',
        label: 'Submit report',
        layout: 'action',
        palette: this.hasSubmitError() ? 'danger' : this.isSubmitSuccess() ? 'success' : 'blue',
        disabled: !this.canSubmitReportUser(),
        ariaLabel: 'Submit report',
        progress: this.showSubmitRing()
          ? {
              state: this.hasSubmitError() ? 'error' : this.isSubmitSuccess() ? 'success' : 'loading',
              shape: 'button'
            }
          : null
      }
    ];
  }

  protected onReportUserFlowValueChange(value: unknown): void {
    const record = this.isRecord(value) ? value : {};
    const reason = `${record['reason'] ?? ''}`;
    this.reportUserForm = {
      handle: this.isContextualReport()
        ? this.reportUserContext()?.targetName?.trim() || ''
        : `${record['handle'] ?? ''}`,
      contextSummary: this.reportContextSummary(),
      reason: this.reportUserReasons.includes(reason)
        ? reason
        : this.reportUserReasons[0] ?? 'Harassment',
      details: `${record['details'] ?? ''}`
    };
    this.clearSubmitStatus();
  }

  protected onReportUserActionMenuSelect(event: AppMenuItemSelectEvent<ReportUserActionId>): void {
    if (event.id === 'report-user-cancel') {
      this.closePopup();
    } else if (event.id === 'report-user-submit') {
      void this.submitReportUser();
    }
  }

  protected reportContextSummary(): string {
    const context = this.reportUserContext();
    if (!context) {
      return '';
    }
    const contextLabel = this.reportContextLabel(context.ownerType);
    const lines = [
      `User: ${context.targetName.trim() || 'Unknown user'}`,
      `${contextLabel}: ${context.eventTitle?.trim() || `Unknown ${contextLabel.toLowerCase()}`}`
    ];
    const dateLabel = this.reportEventDateLabel();
    if (dateLabel) {
      lines.push(`Date: ${dateLabel}`);
    }
    return lines.join('\n');
  }

  private reportContextLabel(ownerType: string | null | undefined): string {
    switch (ownerType) {
      case 'asset':
        return 'Asset';
      case 'subEvent':
        return 'Sub-event';
      case 'group':
        return 'Group';
      default:
        return 'Event';
    }
  }

  protected reportEventDateLabel(): string {
    const context = this.reportUserContext();
    const startAtIso = `${context?.eventStartAtIso ?? ''}`.trim();
    if (startAtIso) {
      const parsed = new Date(startAtIso);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return `${context?.eventTimeframe ?? ''}`.trim();
  }

  protected clearSubmitStatus(): void {
    if (this.isSubmitBusy() || this.reportUserSubmitted) {
      return;
    }
    this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }

  protected async submitReportUser(): Promise<void> {
    const context = this.reportUserContext();
    const activeUserId = this.userProfileStore.activeUserId().trim();
    const target = this.reportUserForm.handle.trim();
    const details = this.reportUserForm.details.trim();
    if (!context || !activeUserId || !this.canSubmitReportUser() || this.isSubmitting()) {
      return;
    }

    this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
    const requestVersion = ++this.submitRequestVersion;
    const abortController = new AbortController();
    this.submitAbortController = abortController;

    const response = await this.usersService.submitReportUser(
      {
        userId: activeUserId,
        handle: target,
        reason: this.reportUserForm.reason,
        details,
        targetUserId: context.targetUserId.trim(),
        memberEntryId: `${context.memberEntryId ?? ''}`.trim() || null,
        eventId: context.eventId.trim(),
        eventTitle: `${context.eventTitle ?? ''}`.trim() || null,
        eventStartAtIso: `${context.eventStartAtIso ?? ''}`.trim() || null,
        sourceType: `${context.sourceType ?? ''}`.trim() || null,
        sourceId: `${context.sourceId ?? ''}`.trim() || null,
        sourceText: `${context.sourceText ?? ''}`.trim() || null,
        chatId: `${context.chatId ?? ''}`.trim() || null,
        messageId: `${context.messageId ?? ''}`.trim() || null,
        assetId: `${context.assetId ?? ''}`.trim() || null,
        assetType: `${context.assetType ?? ''}`.trim() || null
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

  private reportUserReasonIcon(reason: string): string {
    switch (reason) {
      case 'Harassment':
        return 'report';
      case 'Spam':
        return 'mark_email_unread';
      case 'Impersonation':
        return 'person_search';
      case 'Hate speech':
        return 'gpp_bad';
      case 'Scam / Fraud':
        return 'warning_amber';
      default:
        return 'flag';
    }
  }

  private reportUserReasonPalette(reason: string): AppMenuPalette {
    switch (reason) {
      case 'Harassment':
      case 'Hate speech':
        return 'danger';
      case 'Spam':
        return 'orange';
      case 'Impersonation':
        return 'violet';
      case 'Scam / Fraud':
        return 'amber';
      default:
        return 'blue';
    }
  }

  private createInitialForm(): ReportUserFormValue {
    const context = this.reportUserContext();
    return {
      handle: context?.targetName?.trim() || '',
      contextSummary: this.reportContextSummary(),
      reason: this.reportUserReasons[0] ?? 'Harassment',
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
    this.runtimeStore.resetLoadingState(USER_REPORT_USER_SUBMIT_CONTEXT_KEY);
  }
}
