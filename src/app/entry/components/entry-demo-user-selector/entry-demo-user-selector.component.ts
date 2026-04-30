
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

import {
  DEMO_BOOTSTRAP_PROGRESS_STEPS,
  DEMO_SESSION_PROGRESS_STEPS,
  type DemoBootstrapProgressStage
} from '../../../shared/core/demo';
import type { DemoUserListItemDto } from '../../../shared/core';

type DemoUserProgressSegment = {
  stage: DemoBootstrapProgressStage;
  start: number;
  width: number;
};

@Component({
  selector: 'app-entry-demo-user-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatRippleModule
],
  templateUrl: './entry-demo-user-selector.component.html',
  styleUrl: './entry-demo-user-selector.component.scss'
})
export class EntryDemoUserSelectorComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() loadingProgress = 0;
  @Input() loadingLabel = 'Preparing demo data';
  @Input() loadingStage: DemoBootstrapProgressStage = 'selector';
  @Input() errorMessage = '';
  @Input() submitting = false;
  @Input() users: DemoUserListItemDto[] = [];
  @Input() title = 'Select demo user';
  @Input() subtitle = 'Login disabled mode. Choose a demo user to open perspective-based data.';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly retryRequested = new EventEmitter<void>();
  @Output() readonly userSelected = new EventEmitter<string>();

  protected requestClose(): void {
    if (this.submitting) {
      return;
    }
    this.closeRequested.emit();
  }

  protected requestUserSelect(userId: string): void {
    if (this.loading || this.submitting) {
      return;
    }
    this.userSelected.emit(userId);
  }

  protected requestRetry(): void {
    if (this.loading || this.submitting) {
      return;
    }
    this.retryRequested.emit();
  }

  protected userStatusClass(user: DemoUserListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'demo-user-item-blocked';
      case 'deleted':
        return 'demo-user-item-deleted';
      default:
        return '';
    }
  }

  protected userStatusLabel(user: DemoUserListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'Blocked';
      case 'deleted':
        return 'Deleted';
      default:
        return '';
    }
  }

  protected loadingSegments(): ReadonlyArray<DemoUserProgressSegment> {
    const steps = this.loadingStage.startsWith('session')
      ? DEMO_SESSION_PROGRESS_STEPS
      : DEMO_BOOTSTRAP_PROGRESS_STEPS;
    return steps
      .slice(0, -1)
      .map((step, index) => ({
        stage: step.stage,
        start: step.percent,
        width: Math.max(0, steps[index + 1].percent - step.percent)
      }))
      .filter(segment => segment.width > 0);
  }
}
