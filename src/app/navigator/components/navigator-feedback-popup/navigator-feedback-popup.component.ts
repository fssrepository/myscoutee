import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-feedback-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navigator-feedback-popup.component.html',
  styleUrl: './navigator-feedback-popup.component.scss'
})
export class NavigatorFeedbackPopupComponent {
  private readonly navigatorService = inject(NavigatorService);

  protected readonly feedbackCategories = APP_STATIC_DATA.feedbackCategories;
  protected feedbackForm = this.createInitialForm();
  protected feedbackSubmitMessage = '';
  protected feedbackSubmitted = false;

  protected closePopup(): void {
    this.navigatorService.closeSettingsPopup();
  }

  protected submitFeedback(): void {
    const subject = this.feedbackForm.subject.trim();
    const details = this.feedbackForm.details.trim();
    if (!subject || details.length < 8) {
      return;
    }
    this.feedbackSubmitMessage = `Feedback sent successfully in "${this.feedbackForm.category}". Thank you for helping improve MyScoutee.`;
    this.feedbackSubmitted = true;
  }

  private createInitialForm(): { category: string; subject: string; details: string } {
    return {
      category: this.feedbackCategories[0] ?? 'General',
      subject: '',
      details: ''
    };
  }
}
