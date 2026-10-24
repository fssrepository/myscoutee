import { Component, Input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogComponent, type DialogViewConfig, PopupPresenceStore } from '@fssrepository/myscoutee-components';
import { ExplanationLauncherComponent } from './explanation-launcher.component';
import { ExplanationGuideService } from '../../../core/base/services/help/explanation-guide.service';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';

@Component({ selector: 'app-dialog', template: '' })
class TestDialog { @Input() useStore = true; @Input() dialog: DialogViewConfig | null = null; }

describe('Guide launcher common dialog binding', () => {
  it('keeps loading separate, passes each prepared model and sends UI actions back to its service', async () => {
    const open = signal(false), loading = signal(false), visible = signal(false), mode = signal('tour');
    const tourModel = {}, explanationModel = {};
    const guide = { popupOpen: open, loading, hasVisiblePopup: visible, popupMode: mode,
      launcherVisible: () => false, currentContextKey: () => 'landing.home',
      dialogModel: () => tourModel, explanationModel: () => explanationModel,
      closePopup: vi.fn(), showNoGuide: vi.fn(), setTourVisible: vi.fn(), setStepIndex: vi.fn() };
    TestBed.configureTestingModule({ imports: [ExplanationLauncherComponent], providers: [
      { provide: ExplanationGuideService, useValue: guide },
      { provide: AppSetupStore, useValue: { launcherVisible: () => false, guideRequested: signal(false) } },
      { provide: PopupPresenceStore, useValue: { topLayer: () => 0 } }
    ] }).overrideComponent(ExplanationLauncherComponent, { remove: { imports: [DialogComponent] }, add: { imports: [TestDialog] } });
    const fixture = TestBed.createComponent(ExplanationLauncherComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(TestDialog))).toBeNull();
    open.set(true); loading.set(true); fixture.detectChanges();
    const shade = fixture.nativeElement.querySelector('[role=status]');
    expect(shade?.getAttribute('aria-busy')).toBe('true');
    expect(fixture.debugElement.query(By.directive(TestDialog))).toBeNull();
    loading.set(false); fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.directive(TestDialog)).componentInstance as TestDialog;
    expect(dialog.useStore).toBe(false);
    expect(dialog.dialog?.mode).toBe('tour');
    if (dialog.dialog?.mode !== 'tour') throw Error('Expected tour mode');
    expect(dialog.dialog.model).toBe(tourModel);
    dialog.dialog.actions.stepChange(2); expect(guide.setStepIndex).toHaveBeenCalledExactlyOnceWith(2);
    visible.set(true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
    mode.set('document'); fixture.detectChanges();
    const documentDialog = fixture.debugElement.query(By.directive(TestDialog)).componentInstance as TestDialog;
    expect(documentDialog.dialog?.mode).toBe('explanation');
    if (documentDialog.dialog?.mode !== 'explanation') throw Error('Expected explanation mode');
    expect(documentDialog.dialog.model).toBe(explanationModel);
    documentDialog.dialog.actions.close(); expect(guide.closePopup).toHaveBeenCalledOnce();
    open.set(false); fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(TestDialog))).toBeNull();
    fixture.destroy();
  });
});
