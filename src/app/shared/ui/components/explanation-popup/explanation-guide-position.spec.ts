import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ExplanationGuideService, OverlayNavigationStore } from '@fssrepository/myscoutee-components';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import { ExplanationGuideOverlayComponent } from './explanation-guide-overlay.component';

describe('Guide first visible frame', () => {
  let fixture: ComponentFixture<ExplanationGuideOverlayComponent>;
  let surface: HTMLElement;
  let target: HTMLElement;
  let position: () => void;

  beforeEach(async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const stepIndex = signal(0);
    TestBed.configureTestingModule({
      imports: [ExplanationGuideOverlayComponent],
      providers: [
        { provide: ExplanationGuideService, useValue: {
          stepIndex, setStepIndex: (index: number) => stepIndex.set(index), loading: signal(false),
          loadError: signal(false), noGuide: signal(false), popupOpen: signal(true),
          currentContextKey: () => 'test', visibleRevision: () => null,
          visibleGuideFields: () => [{ id: 'target', group: 'card', screenKey: 'test', i18nKey: 'target', order: 0 }],
          setTourVisible: vi.fn(), hasVisiblePopup: () => false, showNoGuide: vi.fn()
        } },
        { provide: OverlayNavigationStore, useValue: { register: () => Symbol(), unregister: vi.fn(), bringToFront: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLanguage: signal('en'), revision: signal(0) } }
      ]
    });
    surface = document.createElement('section');
    surface.dataset['guideSurface'] = 'test';
    target = document.createElement('button');
    target.dataset['guideField'] = 'target';
    target.getBoundingClientRect = () => new DOMRect(20, window.innerHeight - 64, 80, 40);
    target.scrollIntoView = vi.fn();
    surface.append(target);
    document.body.append(surface);
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(ExplanationGuideOverlayComponent);
    fixture.detectChanges();
    position = () => {
      (fixture.componentInstance as unknown as { position(): void }).position();
      fixture.detectChanges();
    };
  });

  afterEach(() => {
    fixture?.destroy();
    surface?.remove();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mountMeasuredCard() {
    position(); // Prepare/scroll the actual target.
    position(); // Mount the card invisibly with its provisional placement.
    const card = fixture.nativeElement.querySelector('.explanation-guide-overlay__card') as HTMLElement;
    card.getBoundingClientRect = () => new DOMRect(parseFloat(card.style.left), parseFloat(card.style.top), 332, 300);
    return fixture.nativeElement.querySelector('.explanation-guide-overlay') as HTMLElement;
  }

  it('keeps the card and focus hidden until the actual card size has a stable placement', () => {
    const overlay = mountMeasuredCard();
    expect(overlay.style.visibility).toBe('hidden');
    expect(overlay.querySelector('.explanation-guide-overlay__focus')).not.toBeNull();
    position(); // Correct the provisional 248px placement using the real 300px card.
    expect(overlay.style.visibility).toBe('hidden');
    position();
    expect(overlay.style.visibility).toBe('');
    const before = overlay.querySelector<HTMLElement>('section')!.style.top;
    position();
    expect(overlay.querySelector<HTMLElement>('section')!.style.top).toBe(before);
  });

  it('shows only the shade during target animation, then reveals the stable focus and card together', () => {
    class PositionEffect {
      getComputedTiming() { return { endTime: 180 }; }
      getKeyframes() { return [{ transform: 'translateY(20px)' }, { transform: 'none' }]; }
    }
    vi.stubGlobal('KeyframeEffect', PositionEffect);
    const animation = { playState: 'running', pending: false, effect: new PositionEffect() };
    target.getAnimations = () => [animation as unknown as Animation];
    const overlay = mountMeasuredCard();
    position();
    position();
    expect(overlay.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__shade')!.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__focus')!.style.visibility).toBe('hidden');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__card')!.style.visibility).toBe('hidden');
    animation.playState = 'finished';
    position();
    expect(overlay.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__focus')!.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__card')!.style.visibility).toBe('');
  });

  it('does not hide or replace the established shade when a later step animates', () => {
    const overlay = mountMeasuredCard();
    position(); position();
    const existingShades = Array.from(overlay.querySelectorAll<HTMLElement>('.explanation-guide-overlay__shade'));
    class PositionEffect {
      getComputedTiming() { return { endTime: 180 }; }
      getKeyframes() { return [{ transform: 'translateY(20px)' }, { transform: 'none' }]; }
    }
    vi.stubGlobal('KeyframeEffect', PositionEffect);
    target.getAnimations = () => [{ playState: 'running', pending: false, effect: new PositionEffect() } as unknown as Animation];
    TestBed.inject(ExplanationGuideService).setStepIndex(1);
    fixture.detectChanges();
    position();
    expect(overlay.style.visibility).toBe('');
    expect(Array.from(overlay.querySelectorAll('.explanation-guide-overlay__shade'))).toEqual(existingShades);
    expect(existingShades.every(shade => shade.style.visibility === '')).toBe(true);
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__card')!.style.visibility).toBe('');
    expect(TestBed.inject(ExplanationGuideService).setTourVisible).toHaveBeenLastCalledWith(true);
  });

  it('keeps the shade visible while recomputing the focus and card after viewport resize', () => {
    const overlay = mountMeasuredCard();
    position(); position();
    expect(overlay.style.visibility).toBe('');
    (fixture.componentInstance as unknown as { onResize(): void }).onResize();
    fixture.detectChanges();
    expect(overlay.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__shade')!.style.visibility).toBe('');
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__card')!.style.visibility).toBe('');
    position();
    expect(overlay.querySelector<HTMLElement>('.explanation-guide-overlay__card')!.style.visibility).toBe('');
  });
  it('uses no-guide feedback when the only available step is Close', () => {
    const guide = TestBed.inject(ExplanationGuideService);
    vi.spyOn(guide, 'visibleGuideFields').mockReturnValue([
      { id: 'close', group: 'menus', screenKey: 'test', i18nKey: 'close', order: 0 }
    ]);
    target.dataset['guideField'] = 'close';
    position();
    expect(guide.showNoGuide).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.explanation-guide-overlay__card')).toBeNull();
  });

  it('retains conditional actions from repeated card owners and only toggles when the owner changes', () => {
    const guide = TestBed.inject(ExplanationGuideService);
    const fields = ['member-grantVote', 'member-profile', 'member-revokeVote'].map((id, order) => ({
      id: 'card-actions:' + id, group: 'menus', screenKey: 'test', i18nKey: id, order
    }));
    vi.spyOn(guide, 'visibleGuideFields').mockReturnValue(fields);
    const makeOwner = (ids: string[], top: number) => {
      const owner = document.createElement('app-menu');
      owner.dataset['guideControl'] = 'card-actions';
      const trigger = document.createElement('button');
      trigger.className = 'app-menu__trigger';
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.dataset['guideItems'] = ids.join('\n');
      trigger.getBoundingClientRect = () => new DOMRect(20, top, 40, 40);
      trigger.scrollIntoView = vi.fn();
      const click = vi.fn(() => {
        const open = trigger.getAttribute('aria-expanded') !== 'true';
        trigger.setAttribute('aria-expanded', String(open));
        owner.querySelector('[role="menu"]')?.remove();
        if (open) {
          const panel = document.createElement('div');
          panel.className = 'app-menu__panel';
          panel.setAttribute('role', 'menu');
          panel.getBoundingClientRect = () => new DOMRect(20, top, 160, 120);
          for (const id of ids) {
            const item = document.createElement('button');
            item.dataset['guideItem'] = id;
            item.getBoundingClientRect = () => new DOMRect(20, top, 160, 40);
            item.scrollIntoView = vi.fn();
            panel.append(item);
          }
          owner.append(panel);
        }
      });
      trigger.addEventListener('click', click);
      owner.append(trigger);
      surface.append(owner);
      return { owner, trigger, click };
    };
    const maya = makeOwner(['member-grantVote', 'member-profile'], 80);
    const evan = makeOwner(['member-revokeVote', 'member-profile'], 180);
    const component = fixture.componentInstance as unknown as {
      fieldsDirty: boolean; indexFields(root: HTMLElement): void; syncAvailableSteps(root: HTMLElement): void;
      steps(): typeof fields; goToStep(index: number): void; settlePosition(): void;
      resolveTarget(field: typeof fields[number], root: HTMLElement): { element: HTMLElement } | null;
    };
    vi.spyOn(component, 'settlePosition').mockImplementation(() => {});
    component.fieldsDirty = true;
    component.indexFields(surface);
    component.syncAvailableSteps(surface);
    expect(component.steps().map(field => field.id)).toContain('card-actions:member-revokeVote');
    const visit = (id: string) => component.goToStep(component.steps().findIndex(field => field.id === 'card-actions:' + id));
    visit('member-grantVote');
    expect(maya.click).toHaveBeenCalledTimes(1);
    expect(evan.click).not.toHaveBeenCalled();
    expect(component.resolveTarget(fields[0], surface)?.element.closest('app-menu')).toBe(maya.owner);
    visit('member-profile');
    expect(maya.click).toHaveBeenCalledTimes(1);
    visit('member-revokeVote');
    expect(maya.click).toHaveBeenCalledTimes(2);
    expect(evan.click).toHaveBeenCalledTimes(1);
    expect(component.resolveTarget(fields[2], surface)?.element.closest('app-menu')).toBe(evan.owner);
    const orderBefore = component.steps().map(field => field.id);
    component.fieldsDirty = true;
    component.indexFields(surface);
    component.syncAvailableSteps(surface);
    expect(component.steps().map(field => field.id)).toEqual(orderBefore);
    visit('member-revokeVote');
    expect(evan.click).toHaveBeenCalledTimes(1);
  });

});
