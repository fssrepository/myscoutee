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

describe('Birthday typing mask', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function control() {
    TestBed.configureTestingModule({ imports: [DateInputComponent], providers: [
      { provide: I18nService, useValue: { revision: () => 0, translate: (value: string) => value } }
    ] });
    const fixture = TestBed.createComponent(DateInputComponent);
    fixture.componentInstance.model = { valueFormat: 'iso-date', updateOn: 'blur', formatWhileTyping: true };
    const changed = vi.fn();
    fixture.componentInstance.registerOnChange(changed);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus'));
    const edit = (data: string | null, inputType = 'insertText') => {
      input.dispatchEvent(new InputEvent('beforeinput', { inputType, data, bubbles: true }));
      let start = input.selectionStart!, end = input.selectionEnd!;
      if (inputType === 'deleteContentBackward' && start === end) start = Math.max(0, start - 1);
      if (inputType === 'deleteContentForward' && start === end) end = Math.min(input.value.length, end + 1);
      input.setRangeText(data ?? '', start, end, 'end');
      input.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true }));
    };
    const commit = async () => {
      input.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { input, changed, edit, commit };
  }

  it('shows fixed separators while typing eight digits and commits only on blur', async () => {
    const { input, edit, changed, commit } = await control();
    expect(input.value).toBe('____/__/__');
    for (const digit of '19741004') edit(digit);
    expect(input.value).toBe('1974/10/04');
    expect(input.selectionStart).toBe(10);
    expect(changed).not.toHaveBeenCalled();
    await commit();
    expect(changed).toHaveBeenLastCalledWith('1974-10-04');
  });

  it('allows moving the caret ahead, replacing the year and deleting across a separator without shifting the day', async () => {
    const { input, edit, changed, commit } = await control();
    input.setSelectionRange(8, 8);
    edit('04');
    expect(input.value).toBe('____/__/04');
    input.setSelectionRange(0, 4);
    edit('1974');
    input.setSelectionRange(5, 5);
    edit('10');
    input.setSelectionRange(0, 4);
    edit('1980');
    expect(input.value).toBe('1980/10/04');
    input.setSelectionRange(8, 8);
    edit(null, 'deleteContentBackward');
    expect(input.value).toBe('1980/1_/04');
    expect(input.selectionStart).toBe(6);
    edit('1');
    await commit();
    expect(changed).toHaveBeenLastCalledWith('1980-11-04');
  });

  it('supports full-date paste and replacing a selected month while keeping separators fixed', async () => {
    const { input, edit, changed, commit } = await control();
    input.select();
    edit('2024-2-29', 'insertFromPaste');
    expect(input.value).toBe('2024/02/29');
    input.setSelectionRange(4, 8);
    edit('03');
    expect(input.value).toBe('2024/03/29');
    await commit();
    expect(changed).toHaveBeenLastCalledWith('2024-03-29');
  });

  it('does not turn an incomplete or impossible date into a saved birthday', async () => {
    const { input, edit, changed, commit } = await control();
    for (const digit of '20250230') edit(digit);
    await commit();
    expect(changed.mock.calls.every(([value]) => value === '')).toBe(true);
    input.select();
    edit('1995');
    expect(input.value).toBe('1995/__/__');
    await commit();
    expect(changed.mock.calls.every(([value]) => value === '')).toBe(true);
  });
});
