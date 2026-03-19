import { Component, HostListener, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LazyBgImageDirective } from '../../../shared/ui';
import { EventFeedbackPopupService } from '../../event-feedback-popup.service';

@Component({
  selector: 'app-event-feedback-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    LazyBgImageDirective
  ],
  templateUrl: './event-feedback-popup.component.html',
  styleUrl: './event-feedback-popup.component.scss'
})
export class EventFeedbackPopupComponent {
  public readonly feedback = inject(EventFeedbackPopupService);

  public isMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 860;
  }

  protected trackByEventFeedbackItem(index: number, item: any): string {
    return item.eventId;
  }
}
