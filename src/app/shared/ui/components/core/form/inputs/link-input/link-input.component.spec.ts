import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../../../../core';
import { LinkInputComponent } from './link-input.component';

describe('LinkInputComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LinkInputComponent],
      providers: [{
        provide: I18nService,
        useValue: {
          revision: () => 0,
          translate: (value: string | null | undefined) => value ?? ''
        }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders a positive configured maxlength on the URL input', () => {
    const fixture = TestBed.createComponent(LinkInputComponent);
    fixture.componentRef.setInput('config', {
      label: 'Website',
      maxLength: 2048
    });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('2048');
    expect(input.maxLength).toBe(2048);
  });
});
