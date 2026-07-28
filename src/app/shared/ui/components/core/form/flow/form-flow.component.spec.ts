import { TestBed } from '@angular/core/testing';

import type { FormFlowControlModel } from './form-flow.types';
import { FormFlowComponent } from './form-flow.component';
import type { LinkInputConfig } from '../inputs/link-input';

describe('FormFlowComponent link controls', () => {
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
});
