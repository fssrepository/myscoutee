import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-report-user-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navigator-report-user-popup.component.html',
  styleUrl: './navigator-report-user-popup.component.scss'
})
export class NavigatorReportUserPopupComponent {
  private readonly navigatorService = inject(NavigatorService);

  protected readonly reportUserReasons = APP_STATIC_DATA.reportUserReasons;
  protected readonly reportUserHandleMinLength = 3;
  protected readonly reportUserDetailsMinLength = 12;
  protected reportUserForm = this.createInitialForm();
  protected reportUserSubmitMessage = '';
  protected reportUserSubmitted = false;

  protected closePopup(): void {
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
    return this.reportUserHandleValid && this.reportUserDetailsValid;
  }

  protected submitReportUser(): void {
    const target = this.reportUserForm.handle.trim();
    if (!this.canSubmitReportUser()) {
      return;
    }
    this.reportUserSubmitMessage = `Report submitted successfully for ${target}. Our moderation team will review it.`;
    this.reportUserSubmitted = true;
  }

  private createInitialForm(): { handle: string; reason: string; details: string } {
    return {
      handle: '',
      reason: this.reportUserReasons[0] ?? 'Harassment',
      details: ''
    };
  }
}
