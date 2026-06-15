import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../shared/app-utils';
import { AppContext } from '../../../shared/ui';
import { AdminShellService } from '../../services/admin-shell.service';

@Component({
  selector: 'app-admin-profile-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-profile-popup.component.html',
  styleUrl: '../admin-popups.scss'
})
export class AdminProfilePopupComponent {
  protected readonly admin = inject(AdminShellService);
  private readonly appCtx = inject(AppContext);
  protected name = '';
  protected headline = '';
  protected about = '';

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'profile') {
        return;
      }
      const user = this.appCtx.activeUserProfile();
      this.name = user?.name ?? '';
      this.headline = user?.headline ?? '';
      this.about = user?.about ?? '';
    });
  }

  protected save(): void {
    this.appCtx.patchActiveUserProfile(current => {
      const name = this.name.trim() || current.name;
      return {
        name,
        initials: AppUtils.initialsFromText(name),
        headline: this.headline.trim(),
        about: this.about.trim()
      };
    });
    this.admin.closePopup();
  }
}
