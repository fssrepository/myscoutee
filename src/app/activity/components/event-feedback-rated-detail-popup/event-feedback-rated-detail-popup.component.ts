import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { EventsService } from '../../../shared/core/base';
import { EventFeedbackDetailDto } from '../../../shared/core/contracts/activity.interface';
import {
  EventFeedbackDetailConverter,
  IndicatorComponent,
  PopupComponent,
  type PopupModel
} from '../../../shared/ui';
import type { EventFeedbackCard } from '../../../shared/ui/models';
import {
  ActivitiesPopupStore,
  type EventFeedbackRatedDetailPopupSession
} from '../../../shared/ui/context/stores/activities-popup.store';

@Component({
  selector: 'app-event-feedback-rated-detail-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    IndicatorComponent,
    PopupComponent
  ],
  templateUrl: './event-feedback-rated-detail-popup.component.html',
  styleUrl: './event-feedback-rated-detail-popup.component.scss'
})
export class EventFeedbackRatedDetailPopupComponent {
  private readonly eventsService = inject(EventsService);
  private readonly activitiesPopupStore = inject(ActivitiesPopupStore);
  private loadRevision = 0;

  protected readonly session = this.activitiesPopupStore.eventFeedbackRatedDetailSession;
  protected readonly detail = signal<EventFeedbackDetailDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly cards = computed(() => {
    const detail = this.detail();
    return detail ? EventFeedbackDetailConverter.convert(detail) : [];
  });

  constructor() {
    effect(() => {
      const session = this.session();
      const revision = ++this.loadRevision;
      this.detail.set(null);
      this.loadError.set('');
      if (!session) {
        this.loading.set(false);
        return;
      }
      void this.loadPersistedDetail(session, revision);
    });
  }

  protected popupModel(session: EventFeedbackRatedDetailPopupSession): PopupModel {
    return {
      title: 'My Event Feedback',
      subtitle: session.eventTitle,
      ariaLabel: `My feedback for ${session.eventTitle}`,
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      onClose: event => this.close(event)
    };
  }

  protected popupZIndex(): number {
    return 12700;
  }

  protected submittedAtLabel(): string {
    const submittedAtIso = this.detail()?.submittedAtIso ?? '';
    if (!submittedAtIso) {
      return '';
    }
    const submittedAt = new Date(submittedAtIso);
    if (Number.isNaN(submittedAt.getTime())) {
      return submittedAtIso;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(submittedAt);
  }

  protected primaryAnswerLabel(card: EventFeedbackCard): string {
    return this.optionLabel(card.answerPrimary, card.primaryOptions);
  }

  protected secondaryAnswerLabel(card: EventFeedbackCard): string {
    return this.optionLabel(card.answerSecondary, card.secondaryOptions);
  }

  protected traitLabels(card: EventFeedbackCard): string[] {
    const labelsById = new Map(card.traitOptions.map(option => [option.id, option.label]));
    return card.selectedTraitIds
      .map(traitId => labelsById.get(traitId) ?? traitId)
      .filter(Boolean);
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.loadRevision += 1;
    this.activitiesPopupStore.closeEventFeedbackRatedDetail();
  }

  private async loadPersistedDetail(
    session: EventFeedbackRatedDetailPopupSession,
    revision: number
  ): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await this.eventsService.loadEventFeedback({
        userId: session.userId,
        eventId: session.eventId
      });
      if (revision !== this.loadRevision || this.session()?.openedAtIso !== session.openedAtIso) {
        return;
      }
      if (detail.eventId !== session.eventId || !detail.submittedAtIso || detail.cards.length === 0) {
        this.loadError.set('The saved feedback could not be loaded.');
        return;
      }
      this.detail.set(detail);
    } catch {
      if (revision === this.loadRevision) {
        this.loadError.set('The saved feedback could not be loaded.');
      }
    } finally {
      if (revision === this.loadRevision) {
        this.loading.set(false);
      }
    }
  }

  private optionLabel(
    value: string,
    options: readonly { value: string; label: string }[]
  ): string {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return 'No answer saved';
    }
    return options.find(option => option.value === normalizedValue)?.label ?? normalizedValue;
  }
}
