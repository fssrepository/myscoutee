import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GDPR_CONTENT } from '../../../shared/gdpr-data';

@Component({
  selector: 'app-navigator-privacy-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navigator-privacy-popup.component.html',
  styleUrl: './navigator-privacy-popup.component.scss'
})
export class NavigatorPrivacyPopupComponent {
  protected readonly gdprContent = GDPR_CONTENT;
}
