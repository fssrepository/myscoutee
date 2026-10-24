import { ExplanationGuideService } from '../../../core/base/services/help/explanation-guide.service';
import { Component, OnDestroy, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PopupComponent,
  type PopupModel,
  FormFlowComponent,
  type FormFlowModel,
  type AppMenuItem,
  type AppMenuPalette
} from '@fssrepository/myscoutee-components';

import { FeedbackStore } from '../../context/stores/feedback/feedback.store';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import { SERVICE_RATING_CRITERIA } from '../../../core/contracts/affinity/rating-snapshot';

/** Evaluation answers opened from the common Feedback list. */
@Component({
  selector: 'app-feedback-evaluation-popup', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-popup [model]="model()" [zIndex]="12600">
    <app-form-flow [model]="flow()" [ngModel]="form()" (ngModelChange)="form.set($event)"
      [saving]="busy()" (save)="submit()"></app-form-flow>
  </app-popup>`
})
export class FeedbackEvaluationPopupComponent implements OnDestroy {
  protected readonly store = inject(FeedbackStore);
  private readonly i18n = inject(I18nService);
  private readonly unregisterGuide = inject(ExplanationGuideService).registerContext('feedback.evaluation');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = signal({ criteria: { ...this.store.selected()?.feedback.criteria } });
  protected readonly model = computed<PopupModel>(() => ({
    title: 'feedback.list.title', subtitle: this.store.selected()?.providerName,
    size: 'wide', height: 'full', errorMessage: this.error(), onClose: () => this.store.close()
  }));
  protected readonly flow = computed<FormFlowModel>(() => {
    const readOnly = this.store.readOnly(), t = (key: string) => this.i18n.translate(key);
    return {
      title: t('feedback.list.title'), layout: 'carousel',
      save: readOnly ? null : { label: 'submit.feedback', icon: 'send' },
      summary: readOnly ? { enabled: false } : { title: 'feedback.evaluation.overview.title', subtitle: 'feedback.evaluation.overview.description', icon: 'fact_check' },
      steps: [{
        id: 'service-rating', title: this.store.selected()?.providerName ?? '',
        subtitle: this.store.selected()?.feedback.caseTitle, icon: 'home_repair_service', palette: 'gold',
        header: {
          title: this.store.selected()?.serviceTitle || this.store.selected()?.feedback.caseTitle,
          subtitle: this.store.selected()?.providerName,
          imageCard: {
            id: this.store.selected()!.feedback.id,
            title: this.store.selected()?.serviceTitle || this.store.selected()!.feedback.caseTitle,
            subtitle: this.store.selected()?.providerName,
            detail: this.store.selected()?.feedback.caseTitle,
            imageUrl: this.store.selected()?.serviceImageUrl || '', layout: 'overlay',
            placeholderIcon: 'home_repair_service', placeholderLabel: 'feedback.evaluation.title'
          }
        },
        controls: [
          ...SERVICE_RATING_CRITERIA.criteria.map(c => ({ id: c.id, guideFieldId: `feedback-evaluation-${c.id}`,
            bind: ['criteria', c.id], kind: 'menu' as const, layout: 'wide' as const,
            label: t(c.label), required: true, disabled: readOnly,
            config: {kind: 'inline' as const, layout: 'tabs' as const, panelMode: 'anchored' as const, closeOnSelect: false,
              model: {layout: 'tabs' as const, groups: [{id: `${c.id}-options`, items: this.options(c.id, readOnly)}]}}
          }))
        ]
      }]
    };
  });
  private options(criterion: string, readOnly: boolean): AppMenuItem[] {
    const palettes: AppMenuPalette[] = ['red', 'orange', 'slate', 'blue', 'green'];
    return [2, 4, 6, 8, 10].map((score, index) => ({
      id: `${criterion}-${score}`, kind: 'radio', value: score, surface: 'tinted', closeOnSelect: false,
      label: `feedback.evaluation.${criterion}.${score}`, palette: palettes[index], disabled: readOnly
    }));
  }
  ngOnDestroy(): void { this.unregisterGuide(); }
  protected async submit(): Promise<void> {
    const item = this.store.selected();
    if (!item || this.store.readOnly() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.action(item, { action: 'submit', ...this.form(), comment: '' });
      this.store.close();
    } catch { this.error.set('feedback.evaluation.failed'); }
    finally { this.busy.set(false); }
  }
}
