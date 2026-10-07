import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent, type PopupModel } from '../core/popup';
import { FormFlowComponent, type FormFlowModel } from '../core/form/flow';
import { ServiceFeedbackStore } from '../../context/stores/service-feedback.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { SERVICE_RATING_CRITERIA } from '../../../core/contracts/rating-snapshot';
import type { AppMenuItem, AppMenuPalette } from '../core/menu';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';

/** Service answers opened from the common Feedback list. */
@Component({
  selector: 'app-service-feedback-popup', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent],
  template: `<app-popup [model]="model()" [zIndex]="12600">
    <app-form-flow [model]="flow()" [ngModel]="form()" (ngModelChange)="form.set($event)"
      [saving]="busy()" (save)="submit()"></app-form-flow>
  </app-popup>`
})
export class ServiceFeedbackPopupComponent implements OnDestroy {
  protected readonly store = inject(ServiceFeedbackStore);
  private readonly i18n = inject(I18nService);
  private readonly unregisterGuide = inject(ExplanationGuideService).registerContext('community.service-feedback');
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
      save: readOnly ? null : { label: 'Submit feedback', icon: 'send' },
      summary: readOnly ? { enabled: false } : { title: 'Overview', subtitle: 'Review your answers before submitting.', icon: 'fact_check' },
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
            placeholderIcon: 'home_repair_service', placeholderLabel: 'service.feedback.title'
          }
        },
        controls: [
          ...SERVICE_RATING_CRITERIA.criteria.map(c => ({ id: c.id, guideFieldId: `service-feedback-${c.id}`,
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
    const palettes: AppMenuPalette[] = ['red', 'orange', 'slate', 'mint', 'green'];
    const choices: AppMenuItem[] = [2, 4, 6, 8, 10].map((score, index) => ({
      id: `${criterion}-${score}`, kind: 'radio', value: score, surface: 'tinted', closeOnSelect: false,
      label: `service.feedback.${criterion}.${score}`, palette: palettes[index], disabled: readOnly
    }));
    // Display already submitted numeric answers faithfully, including older odd scores.
    const saved = this.store.selected()?.feedback.criteria[criterion];
    if (readOnly && saved != null && !choices.some(choice => choice.value === saved))
      choices.push({id: `${criterion}-saved`, kind: 'radio', value: saved, label: `${saved} / 10`, palette: 'slate', disabled: true});
    return choices;
  }
  ngOnDestroy(): void { this.unregisterGuide(); }
  protected async submit(): Promise<void> {
    const item = this.store.selected();
    if (!item || this.store.readOnly() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.store.action(item, { action: 'submit', ...this.form(), comment: '' });
      this.store.close();
    } catch { this.error.set('service.feedback.failed'); }
    finally { this.busy.set(false); }
  }
}
