import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  ExplanationGuideService,
  type GuideField as HelpCenterGuideFieldDto,
  type GuideSection as HelpCenterSectionDto,
  I18nPipe,
  OverlayNavigationStore,
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuTrigger
} from '@myscoutee/components';
import { I18nService } from '../../../core';

type GuideRect = { left: number; top: number; width: number; height: number };

type GuideFrame = {
  targets: GuideRect[];
  shades: GuideRect[];
  left: number;
  top: number;
  width: number;
  height: number;
  cardLeft: number;
  cardTop: number;
  cardWidth: number;
};

type GuideTarget = { element: HTMLElement; repeatedElements?: HTMLElement[]; menuId: string | null; menuPanel: HTMLElement | null };

@Component({
  selector: 'app-explanation-guide-overlay',
  standalone: true,
  imports: [I18nPipe, NgTemplateOutlet, MatIconModule, AppMenuComponent],
  templateUrl: './explanation-guide-overlay.component.html',
  styleUrl: './explanation-guide-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExplanationGuideOverlayComponent implements OnInit, OnDestroy {
  protected readonly guide = inject(ExplanationGuideService);
  private readonly i18n = inject(I18nService);
  private readonly overlayNavigation = inject(OverlayNavigationStore);
  protected readonly frame = signal<GuideFrame | null>(null);
  protected readonly insideMenu = signal(false);
  protected readonly steps = signal<HelpCenterGuideFieldDto[]>([]);
  protected readonly step = this.guide.stepIndex;
  private navigationToken: symbol | null = null;
  private topSurface: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private cardObserver: ResizeObserver | null = null;
  private observedCard: HTMLElement | null = null;
  private pendingFrame = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private actingFromGuide = false;
  private autoOpenedMenuStepKey = '';
  private fieldsDirty = true;
  private preparedTarget: HTMLElement | null = null;
  private fieldsRoot: HTMLElement | null = null;
  private readonly fieldElements = new Map<string, HTMLElement[]>();

  constructor() {
    effect(() => {
      this.guide.stepIndex();
      const loading = this.guide.loading();
      const loadError = this.guide.loadError();
      const noGuide = this.guide.noGuide();
      const popupOpen = this.guide.popupOpen();
      this.guide.visibleGuideFields();
      this.guide.visibleRevision();
      this.guide.currentContextKey();
      this.i18n.currentLanguage();
      if (!popupOpen) this.autoOpenedMenuStepKey = '';
      if (loading || loadError || noGuide) {
        this.frame.set(null);
      }
      this.schedulePosition();
    });
    effect(() => {
      const visible = !this.guide.loading() && (this.guide.noGuide() || this.guide.loadError() || Boolean(this.frame()));
      this.guide.setTourVisible(visible);
      // Register Back only for the actual guide or its stable feedback card.
      if (visible && !this.navigationToken) {
        this.navigationToken = this.overlayNavigation.register(() => this.guide.closePopup());
      }
    });
  }

  ngOnInit(): void {
    this.cardObserver = new ResizeObserver(() => this.schedulePosition());
    this.observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element)
        || !record.target.closest('app-explanation-guide-overlay'))) this.fieldsDirty = true;
      this.schedulePosition();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', this.onSurfaceClick, true);
    document.addEventListener('keydown', this.onEscape, true);
    window.addEventListener('scroll', this.onViewportChange, true);
    this.schedulePosition();
  }

  ngOnDestroy(): void {
    this.guide.setTourVisible(false);
    this.observer?.disconnect();
    this.cardObserver?.disconnect();
    document.removeEventListener('click', this.onSurfaceClick, true);
    document.removeEventListener('keydown', this.onEscape, true);
    window.removeEventListener('scroll', this.onViewportChange, true);
    if (this.navigationToken) this.overlayNavigation.unregister(this.navigationToken);
    cancelAnimationFrame(this.pendingFrame);
    if (this.settleTimer) clearTimeout(this.settleTimer);
    if (this.actionTimer) clearTimeout(this.actionTimer);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.schedulePosition();
  }

  protected closeFromShade(event: Event): void {
    event.stopPropagation();
    this.guide.closePopup();
  }

  protected currentStep(): HelpCenterGuideFieldDto | null {
    return this.steps()[this.step()] ?? null;
  }

  protected progress(): string {
    const total = this.steps().length;
    return total ? `${Math.min(this.step() + 1, total)} / ${total}` : '';
  }

  protected heading(): string {
    if (this.guide.noGuide()) return this.i18n.translate('explanations');
    return this.guide.visibleRevision()?.title || this.i18n.translate('explanations');
  }

  protected title(): string {
    const field = this.currentStep();
    return this.currentSection()?.title || (field ? this.fieldLabel(field) : this.heading());
  }

  protected body(): string {
    const field = this.currentStep();
    return field ? this.fieldDescription(field) : '';
  }

  protected guideSection(): HelpCenterSectionDto | null {
    return this.currentSection();
  }

  protected next(): void {
    if (this.guide.loading() || this.guide.loadError()) return;
    const nextIndex = this.step() + 1;
    if (nextIndex >= this.steps().length) {
      this.closeGuideWithoutTarget();
      return;
    }
    this.goToStep(nextIndex);
  }

  protected previous(): void {
    if (this.guide.loading() || this.guide.loadError() || this.step() <= 0) return;
    this.goToStep(this.step() - 1);
  }

  protected previousItems(): AppMenuItem[] {
    return [{
      id: 'previous', kind: 'action', layout: 'action', icon: 'arrow_back', label: 'back',
      ariaLabel: 'back', palette: 'blue', disabled: this.step() <= 0
    }];
  }

  protected nextItems(): AppMenuItem[] {
    const lastStep = this.step() >= this.steps().length - 1;
    return [{
      id: 'next', kind: 'action', layout: 'action', icon: lastStep ? 'done' : 'arrow_forward',
      label: lastStep ? 'done' : 'next', ariaLabel: lastStep ? 'done' : 'next', palette: 'blue'
    }];
  }

  protected onNavigationSelect(event: AppMenuItemSelectEvent): void {
    if (event.id === 'previous') this.previous();
    else if (event.id === 'next') this.next();
  }

  protected stepPickerTrigger(): AppMenuTrigger {
    const field = this.currentStep();
    return {
      id: 'guide-step-picker', icon: 'format_list_numbered',
      label: field ? this.fieldLabel(field) : this.i18n.translate('explanations'),
      ariaLabel: this.i18n.translate('explanations'), layout: 'pill', palette: 'violet'
    };
  }

  protected stepPickerModel(): AppMenuModel<string, { stepId: string }> {
    const grouped = new Map<string, HelpCenterGuideFieldDto[]>();
    for (const field of this.steps()) {
      const fields = grouped.get(field.group) ?? [];
      fields.push(field);
      grouped.set(field.group, fields);
    }
    return {
      layout: 'tabs', density: 'compact',
      groups: Array.from(grouped, ([id, fields]) => ({
        id,
        label: this.groupLabel(id),
        icon: this.groupIcon(id),
        items: fields.map(field => ({
          id: field.id,
          kind: 'radio' as const,
          label: this.fieldLabel(field),
          description: this.fieldDescription(field),
          icon: this.groupIcon(id),
          checked: this.currentStep()?.id === field.id,
          closeOnSelect: true,
          context: { stepId: field.id }
        }))
      }))
    };
  }

  protected onStepSelect(event: AppMenuItemSelectEvent<string, { stepId: string }>): void {
    const stepIndex = this.steps().findIndex(field => field.id === event.context?.stepId);
    if (stepIndex >= 0) this.goToStep(stepIndex);
  }

  private goToStep(nextIndex: number): void {
    const fields = this.steps();
    const currentIndex = this.step();
    const current = fields[currentIndex];
    const next = fields[nextIndex];
    if (!next) return;

    const root = this.surfaceRoot();
    if (!root) {
      this.guide.setStepIndex(nextIndex);
      this.frame.set(null);
      return;
    }

    const currentMenuId = current ? this.menuIdForField(current, root) : null;
    const nextMenuId = this.menuIdForField(next, root);
    const destination = this.resolveTarget(next, root);

    if (currentMenuId && currentMenuId !== nextMenuId) {
      this.closeMenu(currentMenuId, root);
    }

    if (nextMenuId && !this.guideMenuTriggerId(next, root)) {
      const trigger = this.menuTrigger(nextMenuId, root);
      if (trigger && trigger.getAttribute('aria-expanded') !== 'true') {
        this.clickFromGuide(trigger);
        this.guide.setStepIndex(nextIndex);
        this.settlePosition();
        return;
      }
    }

    this.preparedTarget = null;
    this.guide.setStepIndex(nextIndex);
    if (destination && this.activateTargetForGuideStep(destination)) {
      this.settlePosition();
      return;
    }
    if (destination) this.prepareTarget(destination);
    this.settlePosition();
  }

  private activateTargetForGuideStep(target: GuideTarget): boolean {
    if (target.element.getAttribute('data-guide-activate-on-step') !== 'true'
      || target.element.getAttribute('data-guide-active') === 'true') return false;
    this.clickFromGuide(target.element);
    return true;
  }

  private groupLabel(id: string): string {
    const labels: Record<string, string> = {
      menus: 'Menus', ratings: 'Ratings', order: 'Order', view: 'View', card: 'Card', popup: 'Popup'
    };
    return this.i18n.translate(labels[id] ?? id.replace(/[-_:]+/g, ' '));
  }

  private groupIcon(id: string): string {
    const icons: Record<string, string> = {
      menus: 'menu', ratings: 'star', order: 'sort', view: 'view_module', card: 'credit_card', popup: 'web_asset'
    };
    return icons[id] ?? 'info';
  }

  private fieldLabel(field: HelpCenterGuideFieldDto): string {
    return this.i18n.translate(`${field.i18nKey}.label`);
  }

  private fieldDescription(field: HelpCenterGuideFieldDto): string {
    return this.i18n.translate(`${field.i18nKey}.description`);
  }

  private currentSection(): HelpCenterSectionDto | null {
    const stepId = this.currentStep()?.id;
    if (!stepId) return null;
    return this.guide.visibleRevision()?.sections.find(section => section.guideStepId === stepId) ?? null;
  }

  private readonly onSurfaceClick = (event: MouseEvent): void => {
    const clicked = event.target instanceof Element ? event.target : null;
    if (!clicked || clicked.closest('.explanation-guide-overlay, .floating-launcher-rail') || this.actingFromGuide) return;
    if (!this.guide.hasVisiblePopup()) {
      this.guide.closePopup();
      return;
    }
    this.dismissAfterSurfaceAction();
  };

  private readonly onViewportChange = (): void => this.schedulePosition();

  private readonly onEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.guide.hasVisiblePopup()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.guide.closePopup();
  };

  private dismissAfterSurfaceAction(): void {
    if (this.actionTimer) clearTimeout(this.actionTimer);
    // Hide the old anchor before the user's action starts a slide or replaces
    // its surface. Keep the mode only if that action opens another popup.
    this.frame.set(null);
    const existingPopups = new Set(document.querySelectorAll<HTMLElement>('.ui-popup, [data-guide-surface]'));
    this.actionTimer = setTimeout(() => {
      this.actionTimer = null;
      const openedPopup = Array.from(document.querySelectorAll<HTMLElement>('.ui-popup, [data-guide-surface]'))
        // A mobile popup can still be entering from outside the viewport.
        .some(popup => this.isRendered(popup) && !existingPopups.has(popup));
      if (openedPopup) {
        this.schedulePosition();
      } else {
        this.guide.closePopup();
      }
    }, 60);
  }

  private settlePosition(): void {
    this.schedulePosition();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.schedulePosition(), 180);
  }

  private schedulePosition(): void {
    if (this.pendingFrame || typeof document === 'undefined') return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.position();
    });
  }

  private position(): void {
    if (this.navigationToken) this.overlayNavigation.bringToFront(this.navigationToken);
    if (this.actionTimer) return;
    if (this.guide.loading() || this.guide.loadError() || this.guide.noGuide()) {
      this.frame.set(null);
      return;
    }
    const root = this.surfaceRoot();
    if (!root) {
      this.guide.showNoGuide();
      return;
    }
    if (root !== this.topSurface) {
      this.topSurface = root;
      this.steps.set([]);
      this.guide.setStepIndex(0);
    }

    // Expand a guide-enabled disclosure before counting its rendered controls.
    // Only presentation toggles opt in; business actions never carry this marker.
    const disclosure = root.querySelector<HTMLElement>('[data-guide-activate-on-step="true"][aria-expanded="false"]');
    if (disclosure && this.activateTargetForGuideStep({ element: disclosure, menuId: null, menuPanel: null })) {
      this.settlePosition();
      return;
    }
    this.indexFields(root);
    this.syncAvailableSteps(root);
    if (!this.steps().length) {
      this.guide.showNoGuide();
      return;
    }
    const current = this.currentStep();
    const currentMenuTriggerId = current ? this.guideMenuTriggerId(current, root) : null;
    if (current && currentMenuTriggerId) {
      const menuId = currentMenuTriggerId;
      const trigger = this.menuTrigger(menuId, root);
      const stepKey = `${this.guide.currentContextKey() ?? ''}:${current.id}`;
      if (trigger && this.autoOpenedMenuStepKey !== stepKey) {
        this.autoOpenedMenuStepKey = stepKey;
        if (trigger.getAttribute('aria-expanded') !== 'true') {
          this.clickFromGuide(trigger);
          this.settlePosition();
          return;
        }
      }
    }
    const target = current ? this.resolveTarget(current, root) : null;
    if (target && this.isRendered(target.element) && (this.preparedTarget !== target.element || !this.isVisible(target.element))) {
      this.preparedTarget = target.element;
      this.prepareTarget(target);
      this.settlePosition();
      return;
    }
    if (!target || !this.isRendered(target.element)) {
      this.guide.showNoGuide();
      return;
    }

    const panelRect = target.menuPanel?.getBoundingClientRect() ?? null;
    const rects = (target.repeatedElements ?? [target.element])
      .map(element => this.visibleTargetRect(element))
      .filter(rect => rect.width > 0 && rect.height > 0);
    if (!rects.length) {
      this.frame.set(null);
      return;
    }
    const rect = new DOMRect(
      Math.min(...rects.map(r => r.left)), Math.min(...rects.map(r => r.top)),
      Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left)),
      Math.max(...rects.map(r => r.bottom)) - Math.min(...rects.map(r => r.top))
    );
    this.insideMenu.set(Boolean(target.menuPanel));
    const pad = 5;
    const left = Math.max(0, rect.left - pad);
    const top = Math.max(0, rect.top - pad);
    const width = Math.min(window.innerWidth - left, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top, rect.height + pad * 2);
    const targets = rects.map(r => {
      const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
      return { left: x, top: y, width: Math.min(window.innerWidth - x, r.width + pad * 2), height: Math.min(window.innerHeight - y, r.height + pad * 2) };
    });
    const cardWidth = Math.min(332, window.innerWidth - 24);
    const card = document.querySelector<HTMLElement>('.explanation-guide-overlay__card');
    if (card !== this.observedCard) {
      this.cardObserver?.disconnect();
      if (card) this.cardObserver?.observe(card);
      this.observedCard = card;
    }
    const cardHeight = Math.min(card?.getBoundingClientRect().height || (target.menuPanel && window.innerWidth <= 760 ? 204 : 248), window.innerHeight - 24);
    const placement = this.placeCard(rect, panelRect, cardWidth, cardHeight);
    const nextFrame: GuideFrame = { targets, shades: this.shadeRects(targets), left, top, width, height, cardLeft: Math.max(12, Math.min(placement.left, window.innerWidth - cardWidth - 12)), cardTop: Math.max(12, Math.min(placement.top, window.innerHeight - cardHeight - 12)), cardWidth };
    const previous = this.frame();
    if (!previous || JSON.stringify(nextFrame) !== JSON.stringify(previous)) {
      this.frame.set(nextFrame);
    }
  }

  private shadeRects(targets: GuideRect[]): GuideRect[] {
    let shaded: GuideRect[] = [{ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }];
    for (const target of targets) {
      shaded = shaded.flatMap(area => {
        const left = Math.max(area.left, target.left), top = Math.max(area.top, target.top);
        const right = Math.min(area.left + area.width, target.left + target.width);
        const bottom = Math.min(area.top + area.height, target.top + target.height);
        if (right <= left || bottom <= top) return [area];
        return [
          { left: area.left, top: area.top, width: area.width, height: top - area.top },
          { left: area.left, top, width: left - area.left, height: bottom - top },
          { left: right, top, width: area.left + area.width - right, height: bottom - top },
          { left: area.left, top: bottom, width: area.width, height: area.top + area.height - bottom }
        ].filter(rect => rect.width > 0 && rect.height > 0);
      });
    }
    return shaded;
  }

  private surfaceRoot(): HTMLElement | null {
    if (this.guide.currentContextKey() === 'landing.guide') {
      return document.querySelector<HTMLElement>('app-explanation-launcher [data-guide-surface="landing.guide"]');
    }
    const popups = Array.from(document.querySelectorAll<HTMLElement>('.ui-popup'))
      .filter(popup => this.isRendered(popup))
      .sort((left, right) => Number(getComputedStyle(left).zIndex) - Number(getComputedStyle(right).zIndex));
    const context = this.guide.currentContextKey();
    if (context?.startsWith('landing.')) {
      const surface = document.querySelector<HTMLElement>(`[data-guide-surface="${context}"]`);
      const topPopup = popups[popups.length - 1];
      if (surface && this.isRendered(surface) && (!topPopup || topPopup.contains(surface))) {
        return topPopup ?? surface;
      }
    }
    return popups[popups.length - 1]
      ?? document.querySelector<HTMLElement>('.user-menu-panel.open[data-guide-surface]')
      ?? document.querySelector<HTMLElement>('[data-guide-surface]');
  }

  private syncAvailableSteps(root: HTMLElement): void {
    // Menus render their items only while open. Keep their registered steps
    // available through the owning trigger; ordinary controls must be rendered.
    const fields = this.guide.visibleGuideFields().filter(field => {
      const target = this.resolveTarget(field, root);
      if (target && this.isRendered(target.element)) return true;
      const menuId = this.menuIdForField(field, root);
      const trigger = menuId ? this.menuTrigger(menuId, root) : null;
      if (!trigger || trigger.disabled || !this.isRendered(trigger)) return false;
      const ids = this.menuItemIds(trigger);
      if (ids !== null) return ids.split('\n').includes(field.id.split(':').slice(1).join(':') || field.id);
      return trigger.getAttribute('aria-expanded') !== 'true';
    });
    const menuOrder = new Map<string, { order: number; ids: string[] }>();
    const owners = new Map<HelpCenterGuideFieldDto, string | null>();
    for (const field of fields) {
      const menuId = this.menuIdForField(field, root);
      owners.set(field, menuId);
      if (menuId && !menuOrder.has(menuId)) {
        const trigger = this.menuTrigger(menuId, root);
        menuOrder.set(menuId, { order: field.order, ids: trigger ? this.menuItemIds(trigger)?.split('\n') ?? [] : [] });
      }
    }
    const anchors = new Map(fields.map(field => {
      const owner = owners.get(field);
      const element = owner ? this.menuTrigger(owner, root) ?? this.resolveTarget(field, root)?.element : this.resolveTarget(field, root)?.element;
      return [field, element?.closest<HTMLElement>('[data-guide-order-group]') ?? element] as const;
    }));
    fields.sort((left, right) => {
      if (left.id === 'close' || right.id === 'close') return left.id === 'close' ? 1 : -1;
      const leftAnchor = anchors.get(left), rightAnchor = anchors.get(right);
      if (leftAnchor && rightAnchor && leftAnchor !== rightAnchor) {
        const relation = leftAnchor.compareDocumentPosition(rightAnchor);
        if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      }
      const leftMenu = owners.get(left);
      const rightMenu = owners.get(right);
      const leftGroup = leftMenu ? menuOrder.get(leftMenu) : null;
      const rightGroup = rightMenu ? menuOrder.get(rightMenu) : null;
      if (!leftGroup || leftMenu !== rightMenu) return (leftGroup?.order ?? left.order) - (rightGroup?.order ?? right.order);
      const index = (field: HelpCenterGuideFieldDto) => field.id === leftMenu || field.id.endsWith(':trigger')
        ? -1 : leftGroup.ids.indexOf(field.id.includes(':') ? field.id.slice(leftMenu!.length + 1) : field.id);
      return index(left) - index(right) || left.order - right.order;
    });
    const previous = this.steps();
    if (previous.length === fields.length && previous.every((field, index) => field === fields[index])) return;
    const currentId = previous[this.step()]?.id;
    const retainedIndex = fields.findIndex(field => field.id === currentId);
    this.steps.set(fields);
    this.guide.setStepIndex(retainedIndex >= 0 ? retainedIndex : Math.min(this.step(), Math.max(0, fields.length - 1)));
  }

  private menuItemIds(trigger: HTMLElement): string | null {
    return trigger.closest('[data-guide-menu-items]')?.getAttribute('data-guide-menu-items')
      ?? trigger.getAttribute('data-guide-items');
  }

  private isRendered(element: HTMLElement): boolean {
    if (element.closest('[aria-hidden="true"], [inert]')) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  }

  private closeGuideWithoutTarget(): void {
    this.frame.set(null);
    this.insideMenu.set(false);
    this.guide.closePopup();
  }

  private resolveTarget(field: HelpCenterGuideFieldDto, root: HTMLElement): GuideTarget | null {
    const menuId = this.guideMenuTriggerId(field, root);
    if (menuId) {
      const trigger = this.menuTrigger(menuId, root);
      const menuPanel = this.menuPanel(menuId, root);
      return trigger ? { element: menuPanel ?? trigger, menuId, menuPanel } : null;
    }

    const menuIdFromField = field.id.includes(':') ? field.id.split(':', 1)[0] : null;
    const panel = menuIdFromField ? this.menuPanel(menuIdFromField, root) : null;
    const itemId = menuIdFromField ? field.id.slice(menuIdFromField.length + 1) : field.id;
    const elements = this.fieldElements.get(field.id) ?? [];
    const itemScope = panel ?? (menuIdFromField ? root.querySelector<HTMLElement>(`[data-guide-control="${menuIdFromField}"]`) : null);
    const menuItem = itemScope ? Array.from(itemScope.querySelectorAll<HTMLElement>('[data-guide-item]'))
      .find(element => element.getAttribute('data-guide-item') === itemId) : null;
    const element = menuItem ?? elements.find(candidate => this.isRendered(candidate)) ?? null;
    if (menuItem && menuIdFromField) return { element: menuItem, menuId: menuIdFromField, menuPanel: panel };
    if (!element) return null;
    const repeatScope = element.closest<HTMLElement>('[data-guide-repeat-scope]');
    const repeatedElements = repeatScope
      ? elements.filter(candidate => candidate.closest('[data-guide-repeat-scope]') === repeatScope && this.isRendered(candidate))
      : undefined;
    const menuOwner = element.closest<HTMLElement>('[data-guide-control]');
    const ownerMenuId = menuOwner && menuOwner.querySelector('.app-menu__trigger')
      ? menuOwner.getAttribute('data-guide-control')
      : null;
    return {
      element,
      repeatedElements,
      menuId: ownerMenuId,
      menuPanel: ownerMenuId ? this.menuPanel(ownerMenuId, root) : element.closest<HTMLElement>('.app-menu__panel:not(.app-menu__panel--inline)[role="menu"]')
    };
  }

  private menuIdForField(field: HelpCenterGuideFieldDto, root: HTMLElement): string | null {
    const triggerId = this.guideMenuTriggerId(field, root);
    if (triggerId) return triggerId;
    if (field.id.includes(':')) return field.id.split(':', 1)[0];
    const item = this.findFieldElement(field.id, root);
    const owner = item?.closest<HTMLElement>('[data-guide-control]');
    if (owner?.querySelector('.app-menu__trigger')) return owner.getAttribute('data-guide-control');
    const candidate = field.id.split('-', 1)[0];
    return this.menuTrigger(candidate, root) ? candidate : null;
  }

  private indexFields(root: HTMLElement): void {
    if (!this.fieldsDirty && this.fieldsRoot === root) return;
    this.fieldsDirty = false;
    this.fieldsRoot = root;
    this.fieldElements.clear();
    for (const element of root.querySelectorAll<HTMLElement>('[data-guide-field], [data-guide-item], [data-guide-control], [data-control-id]')) {
      for (const attribute of ['data-guide-field', 'data-guide-item', 'data-guide-control', 'data-control-id']) {
        const id = element.getAttribute(attribute);
        if (id) this.fieldElements.set(id, [...(this.fieldElements.get(id) ?? []), element]);
      }
    }
  }

  private findFieldElement(id: string, root: HTMLElement): HTMLElement | null {
    this.indexFields(root);
    const elements = this.fieldElements.get(id) ?? [];
    return elements.find(element => this.isRendered(element)) ?? null;
  }

  private menuTrigger(menuId: string, root: HTMLElement): HTMLButtonElement | null {
    const controlledTrigger = root.querySelector<HTMLElement>(`[data-guide-control="${menuId}"]`)
      ?.querySelector<HTMLButtonElement>('.app-menu__trigger');
    if (controlledTrigger?.getAttribute('aria-haspopup') === 'menu') return controlledTrigger;
    const menuItem = this.findFieldElement(menuId, root);
    return menuItem instanceof HTMLButtonElement && menuItem.getAttribute('aria-haspopup') === 'menu'
      && (Boolean(menuItem.closest('app-menu, app-menu-trigger')) || menuItem.hasAttribute('data-guide-items'))
      ? menuItem
      : null;
  }

  private menuPanel(menuId: string, root: HTMLElement): HTMLElement | null {
    const control = root.querySelector<HTMLElement>(`[data-guide-control="${menuId}"]`);
    const owner = control ?? this.menuTrigger(menuId, root)?.closest<HTMLElement>('app-menu') ?? null;
    const ownPanel = owner?.querySelector<HTMLElement>('.app-menu__panel[role="menu"]');
    if (ownPanel) return ownPanel;
    const trigger = this.menuTrigger(menuId, root);
    return trigger?.getAttribute('aria-expanded') === 'true'
      ? Array.from(root.querySelectorAll<HTMLElement>('app-menu-outlet .app-menu__panel[role="menu"], .ui-info-card__menu')).filter(panel => this.isRendered(panel)).at(-1) ?? null
      : null;
  }

  private closeMenu(menuId: string, root: HTMLElement): void {
    const trigger = this.menuTrigger(menuId, root);
    if (trigger?.getAttribute('aria-expanded') === 'true') this.clickFromGuide(trigger);
  }

  private isMenuTrigger(field: HelpCenterGuideFieldDto): boolean {
    return field.id.endsWith(':trigger');
  }

  private guideMenuTriggerId(field: HelpCenterGuideFieldDto, root: HTMLElement): string | null {
    if (this.isMenuTrigger(field)) return field.id.slice(0, -':trigger'.length);
    if (field.group !== 'menus' && !field.id.endsWith('card-actions')) return null;
    return this.menuTrigger(field.id, root) ? field.id : null;
  }

  private prepareTarget(target: GuideTarget): void {
    target.element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  }

  private visibleTargetRect(element: HTMLElement): DOMRect {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
    // A fixed target itself also escapes its trigger's scrolling ancestors.
    for (let parent = getComputedStyle(element).position === 'fixed' ? null : element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
      }
      // Our fixed menu panels belong to the viewport. The accordion/list that
      // owns their trigger does not clip their contents, only the panel does.
      if (style.position === 'fixed') break;
    }
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  private clickFromGuide(target: HTMLElement): void {
    this.actingFromGuide = true;
    try {
      target.click();
    } finally {
      this.actingFromGuide = false;
    }
  }

  private placeCard(target: DOMRect, panel: DOMRect | null, width: number, height: number): { left: number; top: number } {
    const gap = 12;
    const margin = 12;
    const clampLeft = (value: number) => Math.max(margin, Math.min(value, window.innerWidth - width - margin));
    const clampTop = (value: number) => Math.max(margin, Math.min(value, window.innerHeight - height - margin));
    const anchor = panel ?? target;
    const candidates = [
      { left: anchor.right + gap, top: clampTop(target.top) },
      { left: anchor.left - width - gap, top: clampTop(target.top) },
      { left: clampLeft(target.left), top: anchor.top - height - gap },
      { left: clampLeft(target.left), top: anchor.bottom + gap }
    ];
    for (const candidate of candidates) {
      const card = { left: candidate.left, top: candidate.top, right: candidate.left + width, bottom: candidate.top + height };
      if (card.left >= margin && card.right <= window.innerWidth - margin && card.top >= margin && card.bottom <= window.innerHeight - margin
        && (card.right <= anchor.left || card.left >= anchor.right || card.bottom <= anchor.top || card.top >= anchor.bottom)) return candidate;
    }
    const freeAbove = anchor.top - margin;
    const freeBelow = window.innerHeight - anchor.bottom - margin;
    return freeAbove >= freeBelow
      ? { left: clampLeft(target.left), top: Math.max(margin, anchor.top - height - gap) }
      : { left: clampLeft(target.left), top: clampTop(anchor.bottom + gap) };
  }

  private isVisible(element: HTMLElement): boolean {
    const rect = this.visibleTargetRect(element);
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth
      && rect.bottom > 0 && rect.top < window.innerHeight;
  }

}
