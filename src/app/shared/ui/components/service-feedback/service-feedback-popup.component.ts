import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent, type PopupModel } from '../core/popup';
import { FormFlowComponent, type FormFlowModel } from '../core/form/flow';
import { ServiceFeedbackStore } from '../../context/stores/service-feedback.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { SERVICE_RATING_CRITERIA } from '../../../core/contracts/rating-snapshot';

/** Service answers opened from the common Feedback list. */
@Component({
  selector: 'app-service-feedback-popup', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent],
  template: `<app-popup [model]="model()" [zIndex]="12600">
    <app-form-flow [model]="flow()" [ngModel]="form()" (ngModelChange)="form.set($event)"
      [saving]="busy()" (save)="submit()"></app-form-flow>
  </app-popup>`
})
export class ServiceFeedbackPopupComponent {
  protected readonly store = inject(ServiceFeedbackStore);
  private readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = signal({ criteria: { ...this.store.selected()?.feedback.criteria }, comment: this.store.selected()?.feedback.comment ?? '' });
  protected readonly model = computed<PopupModel>(() => ({
    title: 'feedback.list.title', subtitle: this.store.selected()?.providerName,
    size: 'wide', height: 'full', errorMessage: this.error(), onClose: () => this.store.close()
  }));
  protected readonly flow = computed<FormFlowModel>(() => {
    const readOnly = this.store.readOnly(), t = (key: string) => this.i18n.translate(key);
    return {
      title: t('feedback.list.title'), layout: 'carousel', header: false,
      save: readOnly ? null : { label: 'Submit feedback', icon: 'send' },
      summary: readOnly ? { enabled: false } : { title: 'Overview', subtitle: 'Review your answers before submitting.', icon: 'fact_check' },
      steps: [{
        id: 'service-rating', title: this.store.selected()?.providerName ?? '',
        subtitle: this.store.selected()?.feedback.caseTitle, icon: 'home_repair_service', palette: 'gold',
        controls: [
          ...SERVICE_RATING_CRITERIA.criteria.map(c => ({ id: c.id, bind: ['criteria', c.id], kind: 'number' as const,
            label: t(c.label), min: 1, max: 10, step: 1, required: true, disabled: readOnly })),
          { id: 'comment', bind: 'comment', kind: 'textarea', label: t('service.feedback.comment'), maxLength: 160, rows: 3, layout: 'wide', disabled: readOnly }
        ]
      }]
    };
  });
  protected async submit(): Promise<void> {
    const item = this.store.selected();
    if (!item || this.store.readOnly() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.action(item, { action: 'submit', ...this.form() });
      this.store.close();
    } catch { this.error.set('service.feedback.failed'); }
    finally { this.busy.set(false); }
  }
}
