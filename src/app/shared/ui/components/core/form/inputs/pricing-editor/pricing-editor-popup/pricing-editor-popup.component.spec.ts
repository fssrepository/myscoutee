import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PopupModel } from '@fssrepository/myscoutee-components';
import { PricingBuilder } from '../../../../../../../core/base/builders';
import { I18nService } from '../../../../../../../core/base/services/localization/i18n.service';
import type { PricingConfig } from '../../../../../../../core/contracts';
import { FormFlowPopupStore, type FormFlowPricingEditorPopupState } from '../../../flow/form-flow-popup.store';
import { PricingEditorPopupComponent } from './pricing-editor-popup.component';

interface PopupView {
  onBasePriceChange(value: number): void;
  pricingPopupModel(popup: FormFlowPricingEditorPopupState): PopupModel;
}

describe('Shared pricing editor popup view', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PricingEditorPopupComponent],
    providers: [{ provide: I18nService, useValue: {
      translate: (key: string) => key, revision: signal(0), currentLanguage: signal('en')
    } }]
  }));
  afterEach(() => TestBed.resetTestingModule());

  function create(readOnly = false) {
    const fixture = TestBed.createComponent(PricingEditorPopupComponent);
    const value = { ...PricingBuilder.createDefaultPricingConfig('event'), enabled: true, basePrice: 10 };
    const popup: FormFlowPricingEditorPopupState = {
      ownerId: 'pricing-owner', title: 'Pricing', subtitle: '', zIndex: 22000,
      value, config: { context: 'event', embedded: true, showPreview: false }, readOnly, canSave: false
    };
    fixture.componentRef.setInput('popup', popup);
    fixture.detectChanges();
    return { fixture, popup, value, view: fixture.componentInstance as unknown as PopupView };
  }

  it('shares the form while keeping edits in the popup draft until Save', () => {
    const { fixture, popup, value, view } = create();
    const store = TestBed.inject(FormFlowPopupStore);
    expect(fixture.nativeElement.querySelectorAll('[data-guide-field="pricing-basePrice"]')).toHaveLength(1);
    view.onBasePriceChange(25);
    expect(value.basePrice).toBe(10);
    expect(store.pricingEditorPopupActionRequest()).toBeNull();
    const model = view.pricingPopupModel(popup);
    const action = model.headerActions?.find(item => item.id === 'pricing-save');
    expect(action?.disabled).toBe(false);
    model.onAction?.({ action: action!, sourceEvent: new Event('click') });
    const request = store.pricingEditorPopupActionRequest();
    expect(request?.kind).toBe('save');
    expect(request?.ownerId).toBe('pricing-owner');
    expect(request?.kind === 'save' && (request.value as PricingConfig).basePrice).toBe(25);
  });

  it('retains the read-only form without exposing Save', async () => {
    const { fixture, popup, view } = create(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-guide-field="pricing-basePrice"] input').disabled).toBe(true);
    expect(view.pricingPopupModel(popup).headerActions?.some(item => item.id === 'pricing-save')).toBe(false);
  });

  it('renders no inline editor when the popup input is absent', () => {
    const fixture = TestBed.createComponent(PricingEditorPopupComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pricing-editor__surface')).toBeNull();
  });
});
