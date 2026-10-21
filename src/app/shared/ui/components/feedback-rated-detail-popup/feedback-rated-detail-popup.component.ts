import { APP_STATIC_DATA } from '../../../core/common/app-static-data';
import { I18nPipe } from '@fssrepository/myscoutee-components';
import { FeedbackService } from '../../../core/base/services/feedback/feedback.service';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { EventsService } from '../../../core/base';
import {
  ExplanationGuideService,
  IndicatorComponent,
  PopupComponent,
  type PopupModel
} from '@fssrepository/myscoutee-components';
import { FeedbackDetailDto } from '../../../core/contracts/feedback/feedback.interface';

import { FeedbackDetailConverter } from '../..';
import type { FeedbackCard } from '../../converters/feedback/feedback.model';
import {
  ActivitiesPopupStore,
  type FeedbackRatedDetailPopupSession
} from '../../context/stores/activity/activities-popup.store';

@Component({
  selector: 'app-feedback-rated-detail-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    IndicatorComponent,
    PopupComponent, I18nPipe
  ],
  templateUrl: './feedback-rated-detail-popup.component.html',
  styleUrl: './feedback-rated-detail-popup.component.scss'
})
export class FeedbackRatedDetailPopupComponent {
  private readonly feedbackService = inject(FeedbackService);
  private readonly eventsService = inject(EventsService);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly activitiesPopupStore = inject(ActivitiesPopupStore);
  private readonly destroyRef = inject(DestroyRef);
  private unregisterExplanationContext: (() => void) | null = null;
  private loadRevision = 0;

  protected readonly session = this.activitiesPopupStore.feedbackRatedDetailSession;
  protected readonly detail = signal<FeedbackDetailDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly cards = computed(() => {
    const detail = this.detail();
    return detail ? FeedbackDetailConverter.convert(detail) : [];
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.unregisterExplanationContext?.();
      this.unregisterExplanationContext = null;
    });
    effect(() => {
      const session = this.session();
      const revision = ++this.loadRevision;
      if (session) {
        this.unregisterExplanationContext ??= this.explanationGuide.registerContext('feedback.detail');
      } else {
        this.unregisterExplanationContext?.();
        this.unregisterExplanationContext = null;
      }
      this.detail.set(null);
      this.loadError.set('');
      if (!session) {
        this.loading.set(false);
        return;
      }
      void this.loadPersistedDetail(session, revision);
    });
  }

  protected popupModel(session: FeedbackRatedDetailPopupSession): PopupModel {
    return {
      title: 'feedback.own.title',
      subtitle: session.eventTitle,
      ariaLabel: `My feedback for ${session.eventTitle}`,
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'default',
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

  protected primaryAnswerLabel(card: FeedbackCard): string {
    return this.optionLabel(card.answerPrimary, card.primaryOptions);
  }

  protected secondaryAnswerLabel(card: FeedbackCard): string {
    return this.optionLabel(card.answerSecondary, card.secondaryOptions);
  }

  protected traitLabels(card: FeedbackCard): string[] {
    const labelsById = new Map(card.traitOptions.map(option => [option.id,
      APP_STATIC_DATA.personalityTraitCatalog.find(trait => trait.id === option.id)?.labelKey ?? option.label]));
    return card.selectedTraitIds
      .map(traitId => labelsById.get(traitId) ?? traitId)
      .filter(Boolean);
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.loadRevision += 1;
    this.activitiesPopupStore.closeFeedbackRatedDetail();
  }

  private async loadPersistedDetail(
    session: FeedbackRatedDetailPopupSession,
    revision: number
  ): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await this.feedbackService.loadDetail({
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
