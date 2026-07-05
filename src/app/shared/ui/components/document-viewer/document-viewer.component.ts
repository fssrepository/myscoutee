import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { ActivatedRoute } from '@angular/router';

import { AppUtils } from '../../../app-utils';
import { APP_STATIC_DATA } from '../../../app-static-data';
import { HelpCenterService, I18nService } from '../../../core';
import type { HelpCenterDocumentKind, HelpCenterRevisionDto } from '../../../core/contracts';
import { LazyBgImageDirective } from '../../directives';
import {
  AccordionComponent,
  type UiAccordionItem,
  type UiAccordionModel,
  type UiAccordionSelectionToggleEvent,
  type UiAccordionToggleEvent
} from '../core/accordion';
import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette } from '../core/menu';
import { IndicatorComponent } from '../core/indicator';
import type {
  DocumentViewerAction,
  DocumentViewerActionEvent,
  DocumentViewerActionVisibility,
  DocumentViewerConfig,
  DocumentViewerHeaderPalette,
  DocumentViewerRouteData,
  DocumentViewerSection,
  DocumentViewerShell
} from './document-viewer.types';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatRippleModule,
    LazyBgImageDirective,
    AccordionComponent,
    IndicatorComponent,
    AppMenuComponent
  ],
  templateUrl: './document-viewer.component.html',
  styleUrl: './document-viewer.component.scss'
})
export class DocumentViewerComponent implements OnChanges, OnInit {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly helpCenter = inject(HelpCenterService);

  @Input() config: DocumentViewerConfig | null = null;

  @Output() readonly action = new EventEmitter<DocumentViewerActionEvent>();

  protected openSectionId = '';
  private selectedSectionIds = new Set<string>();
  private initialSelectedSectionIds = new Set<string>();
  private selectionInputSignature = '';
  private sectionSignature = '';
  private openSectionSignature = '';
  private routeConfig: DocumentViewerConfig | null = null;

  ngOnInit(): void {
    if (!this.config) {
      void this.prepareRouteDocument();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.syncSelectionFromConfig();
      this.syncOpenSection();
    }
  }

  protected isOpen(): boolean {
    return this.activeConfig()?.open !== false;
  }

  protected shell(): DocumentViewerShell {
    return this.activeConfig()?.shell ?? 'page';
  }

  protected isPopupShell(): boolean {
    return this.shell() === 'popup';
  }

  protected ariaLabel(): string {
    const config = this.activeConfig();
    return this.uiText(config?.ariaLabel?.trim() || config?.title || 'Document');
  }

  protected title(): string {
    return this.activeConfig()?.title?.trim() || this.uiText('Document');
  }

  protected description(): string {
    return this.activeConfig()?.description?.trim() ?? '';
  }

  protected versionLabel(): string {
    return this.activeConfig()?.versionLabel?.trim() ?? '';
  }

  protected headerPaletteClass(): string {
    return `document-viewer-header-${this.normalizeHeaderPalette(this.activeConfig()?.headerPalette)}`;
  }

  protected showBrand(): boolean {
    return !this.isPopupShell() && this.activeConfig()?.showBrand !== false;
  }

  protected loading(): boolean {
    return this.activeConfig()?.loading === true;
  }

  protected loadingLabel(): string {
    return this.uiText(this.activeConfig()?.loadingLabel?.trim() || 'Loading document');
  }

  protected closeAriaLabel(): string {
    return this.uiText(this.activeConfig()?.closeAriaLabel?.trim() || 'Close document');
  }

  protected requestClose(sourceEvent?: Event): void {
    sourceEvent?.stopPropagation();
    this.activeConfig()?.onClose?.();
  }

  protected closeFromBackdrop(sourceEvent?: Event): void {
    if (this.activeConfig()?.closeOnBackdrop === false) {
      return;
    }
    this.requestClose(sourceEvent);
  }

  protected toggleSectionSelection(section: DocumentViewerSection, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
    if (!section.toggleable) {
      return;
    }
    const next = new Set(this.selectedSectionIds);
    if (next.has(section.id)) {
      next.delete(section.id);
    } else {
      next.add(section.id);
    }
    this.selectedSectionIds = next;
  }

  protected documentAccordionModel(): UiAccordionModel<string, DocumentViewerSection> {
    const config = this.activeConfig();
    return {
      items: (config?.sections ?? []).map(section => ({
        id: section.id,
        title: section.title,
        icon: section.icon,
        palette: this.sectionAccordionPalette(section),
        open: this.openSectionId === section.id,
        selectable: section.toggleable === true,
        selected: this.isSectionSelected(section),
        selectionAriaLabel: this.selectionAriaLabel(section),
        context: section
      })),
      multi: false,
      labelSize: 'large'
    };
  }

  protected documentSectionFromItem(
    item: UiAccordionItem<string, DocumentViewerSection>
  ): DocumentViewerSection | null {
    return item.context ?? this.activeConfig()?.sections.find(section => section.id === item.id) ?? null;
  }

  protected onDocumentAccordionToggle(event: UiAccordionToggleEvent<string, DocumentViewerSection>): void {
    this.openSectionId = event.open ? event.id : '';
  }

  protected onDocumentAccordionSelectionToggle(event: UiAccordionSelectionToggleEvent<string, DocumentViewerSection>): void {
    const section = this.documentSectionFromItem(event.item);
    if (!section) {
      return;
    }
    this.toggleSectionSelection(section, event.sourceEvent);
  }

  protected isSectionSelected(section: DocumentViewerSection): boolean {
    return this.selectedSectionIds.has(section.id);
  }

  private sectionAccordionPalette(section: DocumentViewerSection): AppMenuPalette {
    if (section.tone === 'mandatory') {
      return 'amber';
    }
    if (section.tone === 'optional') {
      return 'blue';
    }
    return 'slate';
  }

  protected selectionAriaLabel(section: DocumentViewerSection): string {
    const title = section.title?.trim() || this.uiText('Section');
    return this.isSectionSelected(section)
      ? this.uiText(`${title} selected`)
      : this.uiText(`Select ${title}`);
  }

  protected visibleActions(): readonly DocumentViewerAction[] {
    return (this.activeConfig()?.actions ?? []).filter(action => this.isActionVisible(action.visible));
  }

  protected actionMenuItems(): readonly AppMenuItem<string>[] {
    return this.visibleActions().map(action => ({
      id: action.id,
      label: action.label,
      icon: action.icon ?? undefined,
      kind: 'action',
      layout: 'action',
      palette: action.palette ?? 'blue',
      disabled: action.disabled === true,
      progress: action.progress ?? null,
      ariaLabel: action.label
    }));
  }

  protected onActionMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    const action = this.visibleActions().find(item => item.id === event.id);
    if (!action || action.disabled) {
      return;
    }
    this.emitDocumentAction(action, event.sourceEvent);
  }

  protected statusToneClass(): string {
    return this.activeConfig()?.statusTone === 'error'
      ? 'document-viewer-status-message-error'
      : 'document-viewer-status-message-default';
  }

  protected statusMessage(): string {
    return this.activeConfig()?.statusMessage?.trim() ?? '';
  }

  protected emptyIcon(): string {
    return this.activeConfig()?.emptyState?.icon?.trim() || 'description';
  }

  protected emptyTitle(): string {
    return this.uiText(this.activeConfig()?.emptyState?.title?.trim() || 'Document is not available');
  }

  protected emptyDescription(): string {
    return this.uiText(this.activeConfig()?.emptyState?.description?.trim() || 'Document content is not available right now.');
  }

  protected uiText(value: string): string {
    return this.i18n.translate(value);
  }

  private syncSelectionFromConfig(): void {
    const config = this.activeConfig();
    const sections = config?.sections ?? [];
    const sectionSignature = sections
      .map(section => `${section.id}:${section.toggleable === true}:${section.selected === true}`)
      .join('|');
    const selectedIds = config?.selectedSectionIds
      ? config.selectedSectionIds.map(sectionId => `${sectionId ?? ''}`.trim()).filter(Boolean)
      : sections.filter(section => section.selected === true).map(section => section.id);
    const selectionInputSignature = selectedIds.join('|');
    if (sectionSignature === this.sectionSignature && selectionInputSignature === this.selectionInputSignature) {
      return;
    }
    this.sectionSignature = sectionSignature;
    this.selectionInputSignature = selectionInputSignature;
    this.selectedSectionIds = new Set(selectedIds);
    this.initialSelectedSectionIds = new Set(selectedIds);
  }

  private syncOpenSection(): void {
    const sections = this.activeConfig()?.sections ?? [];
    const nextSignature = sections.map(section => section.id).join('|');
    if (sections.length === 0) {
      this.openSectionSignature = '';
      this.openSectionId = '';
      return;
    }
    const signatureChanged = nextSignature !== this.openSectionSignature;
    this.openSectionSignature = nextSignature;
    if (!signatureChanged) {
      if (this.openSectionId && !sections.some(section => section.id === this.openSectionId)) {
        this.openSectionId = sections[0].id;
      }
      return;
    }
    if (!this.openSectionId || !sections.some(section => section.id === this.openSectionId)) {
      this.openSectionId = sections[0].id;
    }
  }

  private currentSelectedSectionIds(): string[] {
    return Array.from(this.selectedSectionIds).sort();
  }

  private isSelectionDirty(): boolean {
    const current = this.currentSelectedSectionIds();
    const initial = Array.from(this.initialSelectedSectionIds).sort();
    if (current.length !== initial.length) {
      return true;
    }
    return current.some((sectionId, index) => sectionId !== initial[index]);
  }

  private isActionVisible(visible: DocumentViewerActionVisibility | undefined): boolean {
    if (visible === 'dirty') {
      return this.isSelectionDirty();
    }
    return visible !== false;
  }

  private emitDocumentAction(action: DocumentViewerAction, sourceEvent?: Event): void {
    this.action.emit({
      id: action.id,
      action,
      selectedSectionIds: this.currentSelectedSectionIds(),
      sourceEvent: sourceEvent ?? new Event(action.id)
    });
  }

  private normalizeHeaderPalette(value: DocumentViewerHeaderPalette | null | undefined): DocumentViewerHeaderPalette {
    return AppUtils.enumValue(value, APP_STATIC_DATA.documentViewerHeaderPalettes, 'amber');
  }

  protected activeConfig(): DocumentViewerConfig | null {
    return this.config ?? this.routeConfig;
  }

  private async prepareRouteDocument(): Promise<void> {
    const data = this.route.snapshot.data as DocumentViewerRouteData;
    const kind = this.normalizeDocumentKind(data.documentKind);
    this.routeConfig = this.createRouteConfig(data, null, true);
    try {
      await this.helpCenter.preload(kind);
      this.routeConfig = this.createRouteConfig(data, this.activeRevision(kind), false);
      this.syncSelectionFromConfig();
      this.syncOpenSection();
    } catch {
      this.routeConfig = this.createRouteConfig(data, null, false);
    }
  }

  private createRouteConfig(
    data: DocumentViewerRouteData,
    revision: HelpCenterRevisionDto | null,
    loading: boolean
  ): DocumentViewerConfig {
    const kind = this.normalizeDocumentKind(data.documentKind);
    return {
      shell: 'page',
      open: true,
      ariaLabel: data.ariaLabel?.trim() || this.defaultAriaLabel(kind),
      title: revision?.summary?.trim() || data.title?.trim() || this.defaultTitle(kind),
      description: revision?.description?.trim() || data.description?.trim() || this.defaultDescription(kind),
      versionLabel: this.routeVersionLabel(revision?.version),
      headerPalette: this.routeHeaderPalette(kind, revision?.headerColor ?? data.headerPalette),
      loading,
      loadingLabel: data.loadingLabel?.trim() || this.defaultLoadingLabel(kind),
      emptyState: {
        icon: data.emptyIcon?.trim() || this.defaultEmptyIcon(kind),
        title: data.emptyTitle?.trim() || this.defaultEmptyTitle(kind),
        description: data.emptyDescription?.trim() || this.defaultEmptyDescription(kind)
      },
      sections: (revision?.sections ?? []).map(section => ({
        id: section.id,
        icon: section.icon,
        title: section.title,
        blurb: section.blurb,
        contentHtml: section.contentHtml,
        points: section.points,
        details: section.details
      }))
    };
  }

  private activeRevision(kind: HelpCenterDocumentKind): HelpCenterRevisionDto | null {
    if (kind === 'privacy') {
      return this.helpCenter.activePrivacyRevision();
    }
    if (kind === 'terms') {
      return this.helpCenter.activeTermsRevision();
    }
    return this.helpCenter.activeRevision();
  }

  private normalizeDocumentKind(value: string | null | undefined): HelpCenterDocumentKind {
    return value === 'privacy' || value === 'terms' ? value : 'help';
  }

  private routeVersionLabel(version: number | null | undefined): string {
    return Number.isFinite(Number(version)) && Number(version) > 0 ? `v${Math.trunc(Number(version))}` : '';
  }

  private routeHeaderPalette(
    kind: HelpCenterDocumentKind,
    value: DocumentViewerHeaderPalette | null | undefined
  ): DocumentViewerHeaderPalette {
    const normalized = this.normalizeHeaderPalette(value);
    return kind === 'help' && normalized === 'amber' ? 'teal' : normalized;
  }

  private defaultAriaLabel(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'GDPR consent';
    }
    if (kind === 'terms') {
      return 'Terms of service';
    }
    return 'Help';
  }

  private defaultTitle(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'Privacy first';
    }
    if (kind === 'terms') {
      return 'Usage terms';
    }
    return 'Help';
  }

  private defaultDescription(kind: HelpCenterDocumentKind): string {
    if (kind === 'terms') {
      return 'Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.';
    }
    return '';
  }

  private defaultLoadingLabel(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'Loading privacy content';
    }
    if (kind === 'terms') {
      return 'Loading terms content';
    }
    return 'Loading help content';
  }

  private defaultEmptyIcon(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'policy';
    }
    if (kind === 'terms') {
      return 'rule';
    }
    return 'help_outline';
  }

  private defaultEmptyTitle(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'Privacy is not available';
    }
    if (kind === 'terms') {
      return 'Terms are not available';
    }
    return 'Help is not available';
  }

  private defaultEmptyDescription(kind: HelpCenterDocumentKind): string {
    if (kind === 'privacy') {
      return 'Privacy content is not available right now.';
    }
    if (kind === 'terms') {
      return 'Terms content is not available right now.';
    }
    return 'Help content is not available right now.';
  }
}
