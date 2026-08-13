import { TestBed } from '@angular/core/testing';

import type { FormFlowControlModel } from './form-flow.types';
import { FormFlowComponent } from './form-flow.component';
import type { LinkInputConfig } from '../inputs/link-input';

describe('FormFlowComponent controls', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('forwards the control maxlength to the shared link input config', () => {
    TestBed.configureTestingModule({
      imports: [FormFlowComponent]
    });
    const fixture = TestBed.createComponent(FormFlowComponent);
    const componentView = fixture.componentInstance as unknown as {
      linkConfig: (control: FormFlowControlModel) => LinkInputConfig;
    };
    const control: FormFlowControlModel = {
      id: 'website',
      bind: 'website',
      kind: 'link',
      label: 'Website',
      placeholder: 'https://',
      required: true,
      maxLength: 2048,
      config: {
        model: {}
      }
    };

    expect(componentView.linkConfig(control)).toEqual(expect.objectContaining({
      label: 'Website',
      placeholder: 'https://',
      required: true,
      maxLength: 2048
    }));

    fixture.destroy();
  });

  it('keeps an empty number input empty and normalizes a pasted leading zero', () => {
    TestBed.configureTestingModule({
      imports: [FormFlowComponent]
    });
    const fixture = TestBed.createComponent(FormFlowComponent);
    const component = fixture.componentInstance;
    const componentView = component as unknown as {
      controlNumberValue: (control: FormFlowControlModel) => number | null;
      updateControlValue: (control: FormFlowControlModel, value: unknown) => void;
    };
    const control: FormFlowControlModel = {
      id: 'height',
      bind: 'height',
      kind: 'number',
      label: 'Height'
    };
    let emittedValue: unknown;
    component.registerOnChange(value => emittedValue = value);

    component.writeValue({ height: '' });
    expect(componentView.controlNumberValue(control)).toBeNull();

    componentView.updateControlValue(control, '0170');
    expect(emittedValue).toEqual({ height: 170 });
    expect(componentView.controlNumberValue(control)).toBe(170);

    componentView.updateControlValue(control, '');
    expect(emittedValue).toEqual({ height: '' });
    expect(componentView.controlNumberValue(control)).toBeNull();

    fixture.destroy();
  });
});
