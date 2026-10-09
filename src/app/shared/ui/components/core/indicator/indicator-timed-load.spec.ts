import { TestBed } from '@angular/core/testing';
import { IndicatorComponent } from './indicator.component';

describe('Timed load ring', () => {
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('uses the existing CSS timeline without scheduling JavaScript progress frames', () => {
    const fixture = TestBed.createComponent(IndicatorComponent);
    Object.assign(fixture.componentInstance, { kind: 'load-ring', state: 'loading', durationMs: 1500 });
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame');
    fixture.componentInstance.ngOnChanges({});
    expect(frame).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-indicator__load-ring-progress.is-timed')).not.toBeNull();
    expect(fixture.nativeElement.style.getPropertyValue('--app-indicator-duration')).toBe('1500ms');
    fixture.componentRef.setInput('state', 'success');
    fixture.detectChanges();
    const circle = fixture.nativeElement.querySelector('.app-indicator__load-ring-progress');
    expect(circle.classList.contains('is-timed')).toBe(false);
    expect(circle.getAttribute('stroke-dashoffset')).toBe('0');
    fixture.destroy();
  });

  it('preserves caller-controlled progress when a position is supplied', () => {
    const fixture = TestBed.createComponent(IndicatorComponent);
    fixture.componentRef.setInput('kind', 'load-ring');
    fixture.componentRef.setInput('state', 'loading');
    fixture.componentRef.setInput('position', 0.4);
    fixture.detectChanges();
    const circle = fixture.nativeElement.querySelector('.app-indicator__load-ring-progress');
    expect(circle.classList.contains('is-timed')).toBe(false);
    expect(circle.getAttribute('stroke-dashoffset')).toBe('60');
    fixture.destroy();
  });
});
