
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

import { I18nPipe, ProgressIndicatorComponent } from '../../../shared/ui';
import {
  type BootstrapProcessStage,
  type UserSelectorListItemDto
} from '../../../shared/core';

@Component({
  selector: 'app-entry-demo-user-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatRippleModule,
    ProgressIndicatorComponent,
    I18nPipe
  ],
  templateUrl: './entry-demo-user-selector.component.html',
  styleUrl: './entry-demo-user-selector.component.scss'
})
export class EntryDemoUserSelectorComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() loadingProgress = 0;
  @Input() loadingLabel = 'Preparing demo data';
  @Input() loadingStage: BootstrapProcessStage = 'selector';
  @Input() errorMessage = '';
  @Input() submitting = false;
  @Input() users: UserSelectorListItemDto[] = [];
  @Input() title = 'Select demo user';
  @Input() subtitle = 'Login disabled mode. Choose a demo user to open perspective-based data.';
  @Input() selectedUserId = '';

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

  protected userStatusClass(user: UserSelectorListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'demo-user-item-blocked';
      case 'deleted':
        return 'demo-user-item-deleted';
      default:
        return this.isNewProfile(user) ? 'demo-user-item-new' : '';
    }
  }

  protected userStatusLabel(user: UserSelectorListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'Blocked';
      case 'deleted':
        return 'Deleted';
      default:
        return this.isNewProfile(user) ? 'New' : '';
    }
  }

  protected userGenderLabel(user: UserSelectorListItemDto): string {
    return user.gender === 'woman' ? 'woman' : 'man';
  }

  protected userAvatarClass(user: UserSelectorListItemDto): string {
    return this.isNewProfile(user) ? 'user-color-setup' : `user-color-${user.gender}`;
  }

  protected isNewProfile(user: UserSelectorListItemDto): boolean {
    const statusText = `${user.statusText ?? ''}`.trim().toLowerCase();
    const hasProfileStateSignal = user.completion !== undefined || user.profileFormVersion !== undefined;
    const completion = Math.max(0, Math.trunc(Number(user.completion) || 0));
    const profileFormVersion = Math.max(0, Math.trunc(Number(user.profileFormVersion) || 0));
    return statusText === 'new'
      || statusText === 'new profile'
      || (hasProfileStateSignal && completion === 0 && profileFormVersion === 0);
  }

  protected selectedUser(): UserSelectorListItemDto | null {
    const normalizedUserId = this.selectedUserId.trim();
    if (!normalizedUserId) {
      return null;
    }
    return this.users.find(user => user.id.trim() === normalizedUserId) ?? null;
  }

  protected loadingPosition(): number {
    const progress = Number(this.loadingProgress);
    if (!Number.isFinite(progress)) {
      return 0;
    }
    return Math.max(0, Math.min(1, progress / 100));
  }
}
