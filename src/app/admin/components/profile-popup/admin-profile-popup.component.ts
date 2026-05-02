import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppContext } from '../../../shared/core';
import { AdminService } from '../../admin.service';

@Component({
  selector: 'app-admin-profile-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-profile-popup.component.html',
  styleUrl: '../admin-popups.scss'
})
export class AdminProfilePopupComponent {
  protected readonly admin = inject(AdminService);
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
    this.admin.updateAdminProfile({
      name: this.name,
      headline: this.headline,
      about: this.about
    });
    this.admin.closePopup();
  }
}
