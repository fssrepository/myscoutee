import { TestBed } from '@angular/core/testing';

import type { FormFlowControlModel } from './form-flow.types';
import { FormFlowComponent } from './form-flow.component';
import type { LinkInputConfig } from '../inputs/link-input';
import { I18nService } from '../../../../../core/base/services/i18n.service';

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

describe('FormFlowComponent initial rendering', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  const model = { title: 'Profile', layout: 'grouped' as const, header: false,
    steps: [{ id: 'basics', title: 'Basics', controls: [
      { id: 'name', bind: 'name', kind: 'text' as const, label: 'Name' }
    ] }] };

  beforeEach(() => {
    frames = new Map(); nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback); return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    TestBed.configureTestingModule({ imports: [FormFlowComponent], providers: [
      { provide: I18nService, useValue: { revision: () => 0, translate: (text: string) => text } }
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  function paint() {
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(0));
  }

  it('paints a busy ring before creating fields, then keeps fields when values/models change', () => {
    const fixture = TestBed.createComponent(FormFlowComponent);
    fixture.componentRef.setInput('model', model);
    fixture.componentInstance.writeValue({ name: 'Anna' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"] app-indicator')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    paint(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    paint(); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.form-flow').getAttribute('aria-busy')).toBe('false');
    fixture.componentRef.setInput('model', { ...model });
    fixture.componentInstance.writeValue({ name: 'Updated' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBe(input);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('continues showing the ring while data is loading and cancels preparation on destroy', () => {
    const fixture = TestBed.createComponent(FormFlowComponent);
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges(); paint(); paint(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    fixture.componentRef.setInput('loading', false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
    fixture.destroy();

    const cancelled = TestBed.createComponent(FormFlowComponent);
    cancelled.detectChanges();
    cancelled.destroy(); paint(); paint();
    expect((cancelled.componentInstance as any).preparing()).toBe(true);
  });
});
