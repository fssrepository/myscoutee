import { TestBed } from '@angular/core/testing';
import { AppCalendarDateAdapter } from './app-calendar-date-adapter';
import { AppUtils } from './app-utils';
import { I18nService } from './core/base/services/i18n.service';
import { DateInputComponent } from './ui/components/core/form/inputs/date-input/date-input.component';

describe('Shared calendar date entry', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each(['1974/10/04', '1974-10-04', '1974.10.04.'])('keeps October 4 in %s and derives Libra', value => {
    TestBed.configureTestingModule({ providers: [AppCalendarDateAdapter] });
    const adapter = TestBed.inject(AppCalendarDateAdapter);
    const date = adapter.parse(value)!;
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([1974, 10, 4]);
    expect(AppUtils.horoscopeByDate(date)).toBe('Libra');
    expect(adapter.format(date, 'ymdInput' as unknown as object)).toBe('1974/10/04');
  });

  it.each(['04/10/1974', '1974/02/30', '2025/02/29', '1974/13/04', '1974/10', '1974'])
  ('does not silently reinterpret an invalid or incomplete date: %s', value => {
    TestBed.configureTestingModule({ providers: [AppCalendarDateAdapter] });
    const adapter = TestBed.inject(AppCalendarDateAdapter);
    expect(adapter.isValid(adapter.parse(value)!)).toBe(false);
  });

  it('preserves a leap day and clears an empty field', () => {
    TestBed.configureTestingModule({ providers: [AppCalendarDateAdapter] });
    const adapter = TestBed.inject(AppCalendarDateAdapter);
    expect(adapter.parse('2024/02/29')?.getDate()).toBe(29);
    expect(adapter.parse('')).toBeNull();
  });

  it('uses the same displayed date, saved ISO value and horoscope in the actual date control', async () => {
    TestBed.configureTestingModule({ imports: [DateInputComponent], providers: [
      { provide: I18nService, useValue: { revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(DateInputComponent);
    fixture.componentInstance.model = { valueFormat: 'iso-date', updateOn: 'blur', meta: { kind: 'horoscope' } };
    fixture.componentInstance.writeValue('1974-10-04');
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('1974/10/04');
    expect(fixture.nativeElement.textContent).toContain('libra');
    const changed = vi.fn();
    fixture.componentInstance.registerOnChange(changed);
    input.value = '1974/04/10';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(changed).toHaveBeenLastCalledWith('1974-04-10');
    expect(fixture.nativeElement.textContent).toContain('aries');
  });
});
