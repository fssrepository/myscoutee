import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import { I18nService } from '../../../shared/i18n/i18n.service';
import type {
  ExplainableSurface,
  HelpCenterDocumentKind,
  HelpCenterHeaderColor,
  HelpCenterRevision,
  HelpCenterSectionPanelSpan,
  HelpCenterSection,
  HelpCenterState
} from '../../../shared/core/base/models';
import { RouteDelayService } from '../../../shared/core/base/services/route-delay.service';
import { EditableImageCarouselComponent } from '../../../shared/ui/components/editable-image-carousel';
import { LazyBgImageDirective } from '../../../shared/ui/directives';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { AdminService } from '../../admin.service';

type EditorTab = 'html' | 'preview';

interface HelpIconOption {
  icon: string;
  label: string;
  group: 'Common' | 'Planning' | 'People' | 'Logistics' | 'Safety';
  keywords: string[];
}

interface HelpPanelSpanOption {
  value: HelpCenterSectionPanelSpan;
  icon: string;
  label: string;
  title: string;
}

interface HelpEditorSectionDraft {
  localId: string;
  id: string;
  icon: string;
  title: string;
  blurb: string;
  contentHtml: string;
  imageUrls: string[];
  panelSpan: HelpCenterSectionPanelSpan;
  optional: boolean;
  mode: EditorTab;
}

interface HelpEditorRevisionDraft {
  baseRevisionId: string | null;
  contextKey: string | null;
  title: string;
  summary: string;
  description: string;
  headerColor: HelpCenterHeaderColor;
  sections: HelpEditorSectionDraft[];
}

interface HelpEditorRevisionRow {
  id: string;
  kind: 'revision' | 'draft';
  revision: HelpCenterRevision | null;
}

@Component({
  selector: 'app-admin-help-editor-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, EditableImageCarouselComponent, LazyBgImageDirective],
  templateUrl: './admin-help-editor-popup.component.html',
  styleUrl: './admin-help-editor-popup.component.scss'
})
export class AdminHelpEditorPopupComponent implements OnDestroy {
  private static readonly ACTION_PENDING_WINDOW_MS = 1500;
  private static readonly LOAD_DEMO_DELAY_MS = 1500;
  private static readonly LOAD_PROGRESS_WINDOW_MS = 3000;
  private static readonly EXPLANATION_IMAGE_SLOT_COUNT = 8;
  private static readonly LAZY_IMAGE_PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  private static readonly FALLBACK_SPAN_2_SECTION_IDS = new Set([
    'affinity-network',
    'activity-chat-message-window',
    'assets-editor',
    'assets-requests',
    'event-editor-main',
    'event-editor-subevents'
  ]);
  private static readonly VOID_HTML_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ]);
  protected readonly admin = inject(AdminService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  private readonly i18n = inject(I18nService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  protected documentKind: HelpCenterDocumentKind = 'help';
  protected selectedContentLang = 'en';
  protected readonly loading = signal(false);
  protected saving = false;
  protected activatingRevisionId = '';
  protected error = '';
  protected selectedRevisionId = '';
  protected openRevisionId = '';
  protected openPreviewSectionId = '';
  protected editing = false;
  protected draft: HelpEditorRevisionDraft | null = null;
  protected draftAccordionOpen = true;
  protected openDraftSectionId = '';
  protected iconPickerSectionId = '';
  protected documentMenuOpen = false;
  protected languageMenuOpen = false;
  protected contextPickerOpen = false;
  protected colorPickerOpen = false;
  protected iconPickerSearch = '';
  protected iconPickerGroup: HelpIconOption['group'] = 'Common';
  protected explanationMenuOpen = false;
  protected selectedExplanationContextKey = 'home.game';
  protected readonly explanationImageSlotCount = AdminHelpEditorPopupComponent.EXPLANATION_IMAGE_SLOT_COUNT;
  private stateLoadedForPopup = false;
  protected readonly loadingRingPerimeter = 100;
  protected readonly loadingProgress = signal(0);
  protected readonly actionRingPerimeter = 100;
  protected readonly panelSpanOptions: readonly HelpPanelSpanOption[] = [
    { value: 'span-1', icon: 'looks_one', label: 'span-1', title: 'One grid column' },
    { value: 'span-2', icon: 'looks_two', label: 'span-2', title: 'Two grid columns' },
    { value: 'span-3', icon: 'view_stream', label: 'span-3', title: 'Full row' }
  ];
  protected readonly defaultHelpDescription = APP_STATIC_DATA.defaultHelpCenterDescription;
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected readonly headerColorOptions: Array<{ id: HelpCenterHeaderColor; label: string }> = [
    { id: 'amber', label: 'Amber' },
    { id: 'blue', label: 'Blue' },
    { id: 'green', label: 'Green' },
    { id: 'rose', label: 'Rose' },
    { id: 'violet', label: 'Violet' },
    { id: 'slate', label: 'Slate' }
  ];
  protected readonly iconPickerGroups: HelpIconOption['group'][] = ['Common', 'Planning', 'People', 'Logistics', 'Safety'];
  protected readonly helpIconOptions: HelpIconOption[] = [
    { icon: 'help_outline', label: 'Help', group: 'Common', keywords: ['support', 'question', 'guide'] },
    { icon: 'info', label: 'Info', group: 'Common', keywords: ['about', 'details', 'notice'] },
    { icon: 'tips_and_updates', label: 'Tips', group: 'Common', keywords: ['hint', 'idea', 'learn'] },
    { icon: 'menu_book', label: 'Guide', group: 'Common', keywords: ['manual', 'docs', 'read'] },
    { icon: 'article', label: 'Article', group: 'Common', keywords: ['page', 'content', 'document'] },
    { icon: 'edit_note', label: 'Notes', group: 'Common', keywords: ['write', 'edit', 'draft'] },
    { icon: 'question_answer', label: 'Questions', group: 'Common', keywords: ['faq', 'answer', 'support'] },
    { icon: 'contact_support', label: 'Contact support', group: 'Common', keywords: ['helpdesk', 'service', 'agent'] },
    { icon: 'lightbulb', label: 'Idea', group: 'Common', keywords: ['tip', 'hint', 'suggestion'] },
    { icon: 'school', label: 'Learn', group: 'Common', keywords: ['training', 'education', 'lesson'] },
    { icon: 'auto_stories', label: 'Stories', group: 'Common', keywords: ['book', 'guide', 'reading'] },
    { icon: 'fact_check', label: 'Fact check', group: 'Common', keywords: ['verify', 'check', 'review'] },
    { icon: 'event_note', label: 'Events', group: 'Planning', keywords: ['calendar', 'schedule', 'sub event'] },
    { icon: 'local_activity', label: 'Activities', group: 'Planning', keywords: ['ticket', 'program', 'session'] },
    { icon: 'checklist', label: 'Checklist', group: 'Planning', keywords: ['todo', 'task', 'steps'] },
    { icon: 'task_alt', label: 'Tasks', group: 'Planning', keywords: ['complete', 'done', 'status'] },
    { icon: 'route', label: 'Route', group: 'Planning', keywords: ['path', 'flow', 'journey'] },
    { icon: 'map', label: 'Map', group: 'Planning', keywords: ['location', 'place', 'area'] },
    { icon: 'calendar_month', label: 'Calendar', group: 'Planning', keywords: ['date', 'month', 'schedule'] },
    { icon: 'event_available', label: 'Event ready', group: 'Planning', keywords: ['confirmed', 'available', 'date'] },
    { icon: 'date_range', label: 'Date range', group: 'Planning', keywords: ['start', 'end', 'period'] },
    { icon: 'timeline', label: 'Timeline', group: 'Planning', keywords: ['sequence', 'flow', 'history'] },
    { icon: 'account_tree', label: 'Structure', group: 'Planning', keywords: ['hierarchy', 'tree', 'sub event'] },
    { icon: 'flag', label: 'Milestone', group: 'Planning', keywords: ['goal', 'marker', 'stage'] },
    { icon: 'category', label: 'Category', group: 'Planning', keywords: ['type', 'group', 'segment'] },
    { icon: 'playlist_add_check', label: 'Plan check', group: 'Planning', keywords: ['list', 'ready', 'steps'] },
    { icon: 'groups', label: 'Groups', group: 'People', keywords: ['team', 'members', 'participants'] },
    { icon: 'person', label: 'Profile', group: 'People', keywords: ['user', 'identity', 'account'] },
    { icon: 'admin_panel_settings', label: 'Admin', group: 'People', keywords: ['manager', 'owner', 'permission'] },
    { icon: 'diversity_3', label: 'Community', group: 'People', keywords: ['social', 'friends', 'network'] },
    { icon: 'forum', label: 'Chat', group: 'People', keywords: ['conversation', 'message', 'talk'] },
    { icon: 'support_agent', label: 'Support', group: 'People', keywords: ['helpdesk', 'contact', 'service'] },
    { icon: 'person_add', label: 'Invite', group: 'People', keywords: ['add', 'member', 'guest'] },
    { icon: 'manage_accounts', label: 'Manage accounts', group: 'People', keywords: ['profile', 'settings', 'users'] },
    { icon: 'badge', label: 'Badge', group: 'People', keywords: ['identity', 'credential', 'role'] },
    { icon: 'how_to_reg', label: 'Registration', group: 'People', keywords: ['signup', 'join', 'approved'] },
    { icon: 'supervisor_account', label: 'Hosts', group: 'People', keywords: ['admin', 'leaders', 'owners'] },
    { icon: 'group_add', label: 'Add group', group: 'People', keywords: ['invite', 'team', 'members'] },
    { icon: 'record_voice_over', label: 'Announcements', group: 'People', keywords: ['speak', 'message', 'broadcast'] },
    { icon: 'volunteer_activism', label: 'Care', group: 'People', keywords: ['support', 'community', 'help'] },
    { icon: 'inventory_2', label: 'Resources', group: 'Logistics', keywords: ['asset', 'capacity', 'supplies'] },
    { icon: 'directions_car', label: 'Transport', group: 'Logistics', keywords: ['car', 'travel', 'vehicle'] },
    { icon: 'apartment', label: 'Accommodation', group: 'Logistics', keywords: ['stay', 'room', 'hotel'] },
    { icon: 'restaurant', label: 'Food', group: 'Logistics', keywords: ['meal', 'catering', 'dining'] },
    { icon: 'payments', label: 'Payments', group: 'Logistics', keywords: ['price', 'money', 'cost'] },
    { icon: 'qr_code_2', label: 'Tickets', group: 'Logistics', keywords: ['qr', 'pass', 'entry'] },
    { icon: 'warehouse', label: 'Warehouse', group: 'Logistics', keywords: ['storage', 'stock', 'inventory'] },
    { icon: 'luggage', label: 'Luggage', group: 'Logistics', keywords: ['bag', 'travel', 'equipment'] },
    { icon: 'hotel', label: 'Hotel', group: 'Logistics', keywords: ['room', 'bed', 'sleep'] },
    { icon: 'flight', label: 'Flight', group: 'Logistics', keywords: ['air', 'travel', 'transport'] },
    { icon: 'train', label: 'Train', group: 'Logistics', keywords: ['rail', 'travel', 'transport'] },
    { icon: 'local_shipping', label: 'Shipping', group: 'Logistics', keywords: ['delivery', 'truck', 'move'] },
    { icon: 'build', label: 'Tools', group: 'Logistics', keywords: ['fix', 'setup', 'equipment'] },
    { icon: 'construction', label: 'Construction', group: 'Logistics', keywords: ['work', 'setup', 'build'] },
    { icon: 'room_service', label: 'Service', group: 'Logistics', keywords: ['hospitality', 'food', 'support'] },
    { icon: 'shopping_bag', label: 'Supplies', group: 'Logistics', keywords: ['items', 'goods', 'purchase'] },
    { icon: 'verified_user', label: 'Verified', group: 'Safety', keywords: ['trust', 'profile', 'approved'] },
    { icon: 'shield', label: 'Shield', group: 'Safety', keywords: ['safe', 'protect', 'security'] },
    { icon: 'policy', label: 'Policy', group: 'Safety', keywords: ['rules', 'moderation', 'terms'] },
    { icon: 'health_and_safety', label: 'Health', group: 'Safety', keywords: ['care', 'emergency', 'medical'] },
    { icon: 'lock', label: 'Privacy', group: 'Safety', keywords: ['private', 'secure', 'access'] },
    { icon: 'report', label: 'Report', group: 'Safety', keywords: ['flag', 'issue', 'warning'] },
    { icon: 'security', label: 'Security', group: 'Safety', keywords: ['protect', 'guard', 'safe'] },
    { icon: 'privacy_tip', label: 'Privacy tip', group: 'Safety', keywords: ['data', 'safe', 'notice'] },
    { icon: 'lock_open', label: 'Unlock', group: 'Safety', keywords: ['access', 'permission', 'open'] },
    { icon: 'visibility', label: 'Visible', group: 'Safety', keywords: ['show', 'view', 'public'] },
    { icon: 'visibility_off', label: 'Hidden', group: 'Safety', keywords: ['private', 'hide', 'restricted'] },
    { icon: 'emergency', label: 'Emergency', group: 'Safety', keywords: ['urgent', 'alert', 'medical'] },
    { icon: 'warning', label: 'Warning', group: 'Safety', keywords: ['alert', 'risk', 'attention'] },
    { icon: 'block', label: 'Blocked', group: 'Safety', keywords: ['deny', 'stop', 'ban'] },
    { icon: 'rule', label: 'Rules', group: 'Safety', keywords: ['policy', 'terms', 'check'] },
    { icon: 'gavel', label: 'Decision', group: 'Safety', keywords: ['moderation', 'rules', 'legal'] }
  ];
  protected visibleIconOptions: HelpIconOption[] = [];
  protected iconPickerActiveLabel = 'Common icons';
  protected iconPickerActiveCount = 0;
  private loadingProgressTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingProgressStartedAtMs = 0;
  private loadingCompletionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'help-editor') {
        this.stateLoadedForPopup = false;
        this.editing = false;
        this.draft = null;
        this.clearLoadingCompletionTimer();
        this.clearLoadingProgress();
        this.loading.set(false);
        this.closeDocumentMenu();
        this.closeLanguageMenu();
        this.closeContextPicker();
        this.closeIconPicker();
        this.closeColorPicker();
        return;
      }
      if (!this.stateLoadedForPopup) {
        this.stateLoadedForPopup = true;
        void this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearLoadingCompletionTimer();
    this.clearLoadingProgress();
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.iconPickerSectionId && !this.documentMenuOpen && !this.languageMenuOpen && !this.contextPickerOpen && !this.colorPickerOpen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeDocumentMenu();
    this.closeLanguageMenu();
    this.closeContextPicker();
    this.closeIconPicker();
    this.closeColorPicker();
  }

  protected async load(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.clearLoadingCompletionTimer();
    this.clearLoadingProgress();
    this.loading.set(true);
    this.beginLoadingProgress();
    this.error = '';
    try {
      const adminUserId = this.actorUserId();
      const stateLoads: Array<Promise<HelpCenterState>> = [
        this.helpCenter.loadAdminState(
          adminUserId,
          this.documentKind,
          this.selectedContentLang,
          this.documentKind === 'explanation' ? null : this.selectedExplanationContextKey
        )
      ];
      if (this.documentKind !== 'explanation') {
        stateLoads.push(this.helpCenter.loadAdminState(adminUserId, 'explanation', this.selectedContentLang, null));
      }
      await Promise.all([
        ...stateLoads,
        this.routeDelay.waitForRouteDelay(
          this.adminContentRoute(),
          undefined,
          undefined,
          AdminHelpEditorPopupComponent.LOAD_DEMO_DELAY_MS
        )
      ]);
      this.selectInitialRevision(this.revisions(), this.activeRevision());
    } catch {
      this.error = this.loadErrorLabel();
    } finally {
      this.endLoadingProgress();
      this.completeLoadingAfterCheck();
    }
  }

  protected async selectDocumentKind(kind: HelpCenterDocumentKind, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.closeDocumentMenu();
    this.closeLanguageMenu();
    this.closeContextPicker();
    this.explanationMenuOpen = false;
    if (this.documentKind === kind || this.loading() || this.isAnyActionPending()) {
      return;
    }
    this.documentKind = kind;
    this.editing = false;
    this.draft = null;
    this.draftAccordionOpen = true;
    this.selectedRevisionId = '';
    this.openRevisionId = '';
    this.openPreviewSectionId = '';
    this.openDraftSectionId = '';
    this.error = '';
    this.closeIconPicker();
    this.closeColorPicker();
    await this.load();
  }

  protected contentLanguages(): Array<{ lang: string; label: string }> {
    return this.currentState()?.availableLanguages?.length
      ? this.currentState()!.availableLanguages
      : APP_STATIC_DATA.contentLanguages;
  }

  protected explainableSurfaces(): ExplainableSurface[] {
    return [...APP_STATIC_DATA.explainableSurfaces]
      .filter(surface => surface.enabled)
      .sort((left, right) => left.order - right.order);
  }

  protected selectedExplanationSurface(): ExplainableSurface | null {
    return this.explainableSurfaces().find(surface => surface.key === this.selectedExplanationContextKey) ?? null;
  }

  protected explanationSurfaceLabel(contextKey: string | null | undefined): string {
    return this.explanationSurface(contextKey)?.label ?? 'Home cards';
  }

  protected explanationSurface(contextKey: string | null | undefined): ExplainableSurface | null {
    const normalized = `${contextKey ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    return this.explainableSurfaces().find(surface => surface.key === normalized) ?? null;
  }

  protected explanationMenuItemLabel(surface: ExplainableSurface): string {
    const draft = this.documentKind === 'explanation'
      && this.editing
      && this.draft?.contextKey === surface.key
      ? this.draft
      : null;
    if (draft?.title?.trim()) {
      return draft.title.trim();
    }
    const revision = this.explanationRevisionForSurface(surface);
    return revision?.title?.trim() || surface.label;
  }

  protected explanationMenuItemMeta(surface: ExplainableSurface): string {
    const revision = this.explanationRevisionForSurface(surface);
    return revision ? `v${revision.version}` : 'No popup';
  }

  protected selectDraftContext(contextKey: string): void {
    const normalized = this.normalizeExplanationContextKey(contextKey);
    this.selectedExplanationContextKey = normalized;
    if (this.draft) {
      this.draft.contextKey = normalized;
    }
  }

  protected openContextPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.loading() || this.saving || this.isAnyActionPending()) {
      return;
    }
    this.closeDocumentMenu();
    this.closeLanguageMenu();
    this.closeIconPicker();
    this.closeColorPicker();
    this.contextPickerOpen = true;
  }

  protected closeContextPicker(event?: Event): void {
    event?.stopPropagation();
    this.contextPickerOpen = false;
  }

  protected selectContextFromPicker(surface: ExplainableSurface, event?: Event): void {
    event?.stopPropagation();
    if (this.saving || !surface.enabled) {
      return;
    }
    this.selectDraftContext(surface.key);
    this.closeContextPicker();
  }

  protected selectedContentLanguageLabel(): string {
    return this.contentLanguages().find(language => language.lang === this.selectedContentLang)?.label ?? 'English';
  }

  protected contentLanguageFlag(lang: string): string {
    const flags: Record<string, string> = { en: '🇬🇧', hu: '🇭🇺' };
    return flags[this.normalizeContentLang(lang)] ?? '🌐';
  }

  protected toggleLanguageMenu(event?: Event): void {
    event?.stopPropagation();
    if (this.loading() || this.isAnyActionPending()) {
      return;
    }
    this.closeDocumentMenu();
    this.closeIconPicker();
    this.closeContextPicker();
    this.closeColorPicker();
    this.languageMenuOpen = !this.languageMenuOpen;
  }

  protected async selectContentLanguage(lang: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    const normalized = this.normalizeContentLang(lang);
    if (normalized === this.selectedContentLang || this.loading() || this.isAnyActionPending()) {
      this.closeLanguageMenu();
      return;
    }
    const reopenEditor = this.editing;
    this.selectedContentLang = normalized;
    this.closeLanguageMenu();
    this.editing = false;
    this.draft = null;
    this.draftAccordionOpen = true;
    this.selectedRevisionId = '';
    this.openRevisionId = '';
    this.openPreviewSectionId = '';
    this.openDraftSectionId = '';
    this.error = '';
    await this.load();
    if (reopenEditor && !this.error) {
      const revision = this.selectedRevision();
      this.beginEditingDraft(revision ? this.draftFromRevision(revision) : this.emptyDraft());
    }
  }

  protected close(): void {
    this.editing = false;
    this.draft = null;
    this.draftAccordionOpen = true;
    this.closeDocumentMenu();
    this.closeLanguageMenu();
    this.closeContextPicker();
    this.closeIconPicker();
    this.closeColorPicker();
    this.admin.closePopup();
  }

  protected toggleDocumentMenu(event?: Event): void {
    event?.stopPropagation();
    if (this.loading() || this.isAnyActionPending()) {
      return;
    }
    this.closeLanguageMenu();
    this.closeContextPicker();
    this.documentMenuOpen = !this.documentMenuOpen;
    this.explanationMenuOpen = false;
    this.closeIconPicker();
    this.closeContextPicker();
    this.closeColorPicker();
  }

  protected closeDocumentMenu(event?: Event): void {
    event?.stopPropagation();
    this.documentMenuOpen = false;
    this.explanationMenuOpen = false;
  }

  protected openExplanationMenu(event?: Event): void {
    event?.stopPropagation();
    if (this.loading() || this.isAnyActionPending()) {
      return;
    }
    this.explanationMenuOpen = true;
  }

  protected closeExplanationMenu(event?: Event): void {
    event?.stopPropagation();
    this.explanationMenuOpen = false;
  }

  protected async selectExplanationSurface(surface: ExplainableSurface, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.loading() || this.isAnyActionPending() || !surface.enabled) {
      return;
    }
    const wasExplanation = this.documentKind === 'explanation';
    this.selectedExplanationContextKey = surface.key;
    this.explanationMenuOpen = false;
    await this.selectDocumentKind('explanation', event);
    if (wasExplanation && this.documentKind === 'explanation') {
      await this.load();
    }
  }

  protected async createExplanationItem(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.loading() || this.isAnyActionPending()) {
      return;
    }
    this.selectedExplanationContextKey = '';
    this.selectedRevisionId = '';
    this.openRevisionId = '';
    this.openPreviewSectionId = '';
    this.explanationMenuOpen = false;
    if (this.documentKind !== 'explanation') {
      await this.selectDocumentKind('explanation', event);
    } else {
      this.closeDocumentMenu();
      await this.load();
    }
    this.beginEditingDraft(this.emptyDraft(null));
  }

  protected closeLanguageMenu(event?: Event): void {
    event?.stopPropagation();
    this.languageMenuOpen = false;
  }

  protected currentState(): HelpCenterState | null {
    if (this.documentKind === 'privacy') {
      return this.helpCenter.privacyState();
    }
    if (this.documentKind === 'explanation') {
      return this.helpCenter.explanationState();
    }
    return this.helpCenter.state();
  }

  protected revisions(): HelpCenterRevision[] {
    const revisions = this.currentState()?.revisions ?? [];
    if (this.documentKind !== 'explanation') {
      return revisions;
    }
    return revisions.filter(revision => this.normalizeExplanationContextKey(revision.contextKey) === this.selectedExplanationContextKey);
  }

  protected revisionRows(): HelpEditorRevisionRow[] {
    const revisions = this.revisions();
    const active = this.activeRevision();
    const activeId = active?.id ?? '';
    const draft = this.editing ? this.draft : null;
    const rows: HelpEditorRevisionRow[] = [];
    const inactiveRevisions = revisions
      .filter(revision => revision.id !== activeId)
      .sort((left, right) => right.version - left.version);

    if (active) {
      rows.push(this.revisionRow(active));
    }
    if (draft) {
      rows.push(this.draftRow());
    }
    for (const revision of inactiveRevisions) {
      rows.push(this.revisionRow(revision));
    }
    return rows;
  }

  protected activeRevision(): HelpCenterRevision | null {
    const active = this.currentState()?.activeRevision ?? null;
    if (this.documentKind !== 'explanation') {
      return active;
    }
    if (active && this.normalizeExplanationContextKey(active.contextKey) === this.selectedExplanationContextKey) {
      return active;
    }
    return this.revisions().find(revision => revision.active) ?? null;
  }

  protected selectedRevision(): HelpCenterRevision | null {
    const revisions = this.revisions();
    return revisions.find(revision => revision.id === this.selectedRevisionId)
      ?? this.activeRevision()
      ?? revisions[0]
      ?? null;
  }

  protected isRevisionOpen(revision: HelpCenterRevision): boolean {
    return this.openRevisionId === revision.id;
  }

  protected toggleRevision(revision: HelpCenterRevision, event?: Event): void {
    event?.stopPropagation();
    this.selectedRevisionId = revision.id;
    this.openRevisionId = this.openRevisionId === revision.id ? '' : revision.id;
    this.openPreviewSectionId = revision.sections[0]?.id ?? '';
  }

  protected togglePreviewSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openPreviewSectionId = this.openPreviewSectionId === sectionId ? '' : sectionId;
  }

  protected startEditing(event?: Event): void {
    event?.stopPropagation();
    const revision = this.selectedRevision();
    this.beginEditingDraft(revision ? this.draftFromRevision(revision) : this.emptyDraft());
  }

  protected startEditingRevision(revision: HelpCenterRevision, event?: Event): void {
    event?.stopPropagation();
    this.selectedRevisionId = revision.id;
    this.beginEditingDraft(this.draftFromRevision(revision));
  }

  protected startNewRevision(event?: Event): void {
    event?.stopPropagation();
    this.beginEditingDraft(this.emptyDraft());
  }

  protected cancelEditing(event?: Event): void {
    event?.stopPropagation();
    this.editing = false;
    this.draft = null;
    this.draftAccordionOpen = true;
    this.error = '';
    this.closeIconPicker();
    this.closeColorPicker();
    this.closeContextPicker();
  }

  protected toggleDraftRevision(event?: Event): void {
    event?.stopPropagation();
    this.draftAccordionOpen = !this.draftAccordionOpen;
  }

  protected addDraftSection(event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const next: HelpEditorSectionDraft = {
      localId: this.newLocalId(),
      id: '',
      icon: this.defaultSectionIcon(),
      title: this.defaultContentSectionTitle(),
      blurb: '',
      contentHtml: this.defaultContentSectionHtml(),
      imageUrls: [],
      panelSpan: 'span-1',
      optional: false,
      mode: 'html'
    };
    this.draft.sections = [...this.draft.sections, next];
    this.openDraftSectionId = next.localId;
    this.closeIconPicker();
  }

  protected removeDraftSection(section: HelpEditorSectionDraft, event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    this.draft.sections = this.draft.sections.filter(item => item.localId !== section.localId);
    if (this.openDraftSectionId === section.localId) {
      this.openDraftSectionId = this.draft.sections[0]?.localId ?? '';
    }
    if (this.iconPickerSectionId === section.localId) {
      this.closeIconPicker();
    }
  }

  protected toggleDraftSection(section: HelpEditorSectionDraft, event?: Event): void {
    event?.stopPropagation();
    const nextOpenSectionId = this.openDraftSectionId === section.localId ? '' : section.localId;
    this.openDraftSectionId = nextOpenSectionId;
  }

  protected toggleDraftSectionMode(section: HelpEditorSectionDraft, event?: Event): void {
    event?.stopPropagation();
    if (this.openDraftSectionId !== section.localId) {
      this.openDraftSectionId = section.localId;
      this.closeIconPicker();
    }
    section.mode = section.mode === 'html' ? 'preview' : 'html';
  }

  protected previewSectionLayoutClass(section: { id?: string | null; contentHtml?: string | null; panelSpan?: string | null; panelLayout?: string | null }): string | null {
    const span = this.sectionPanelSpan(section) ?? 'span-1';
    return `help-editor-html-preview--${span}`;
  }

  protected previewPanelSpanClass(section: { id?: string | null; contentHtml?: string | null; panelSpan?: string | null; panelLayout?: string | null }): string | null {
    const span = this.sectionPanelSpan(section) ?? 'span-1';
    return `help-editor-preview-section--${span}`;
  }

  protected previewSectionContentHtml(section: {
    title?: string | null;
    contentHtml?: string | null;
    imageUrls?: readonly string[] | null;
  }): string {
    const contentHtml = `${section.contentHtml ?? ''}`.trim();
    if (/<img[\s>]/i.test(contentHtml)) {
      return contentHtml;
    }
    const imageUrl = `${section.imageUrls?.[0] ?? ''}`.trim();
    if (!imageUrl) {
      return contentHtml;
    }
    const seededFigure = `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${this.escapeHtmlAttribute(this.lazyImagePlaceholderSrc(imageUrl))}" alt="${this.escapeHtmlAttribute(section.title ?? '')}"></figure>`;
    return `${contentHtml}${contentHtml ? '' : ''}${seededFigure}`;
  }

  protected setDraftSectionPanelSpan(
    section: HelpEditorSectionDraft,
    panelSpan: HelpCenterSectionPanelSpan,
    event?: Event
  ): void {
    event?.stopPropagation();
    section.panelSpan = panelSpan;
  }

  protected formatPastedSectionHtml(section: HelpEditorSectionDraft, event: ClipboardEvent): void {
    event.stopPropagation();
    const pasted = this.htmlFromClipboardPayload(
      event.clipboardData?.getData('text/html') ?? '',
      event.clipboardData?.getData('text/plain') ?? ''
    );
    if (!pasted.trim()) {
      return;
    }
    event.preventDefault();
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
    const current = section.contentHtml ?? '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? start;
    const merged = `${current.slice(0, start)}${pasted}${current.slice(end)}`;
    section.contentHtml = this.formatHtmlFragment(merged);
    queueMicrotask(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = section.contentHtml.length;
      }
    });
  }

  protected setDraftSectionImageUrls(section: HelpEditorSectionDraft, imageUrls: readonly string[] | null | undefined): void {
    section.imageUrls = this.normalizeSectionImageUrls(imageUrls);
  }

  protected openIconPicker(section: HelpEditorSectionDraft, event?: Event): void {
    event?.stopPropagation();
    if (this.iconPickerSectionId === section.localId) {
      this.closeIconPicker();
      return;
    }
    const matchingOption = this.helpIconOptions.find(option => option.icon === section.icon);
    this.iconPickerSectionId = section.localId;
    this.iconPickerGroup = matchingOption?.group ?? 'Common';
    this.iconPickerSearch = '';
    this.closeContextPicker();
    this.closeColorPicker();
    this.refreshIconPickerOptions();
  }

  protected closeIconPicker(event?: Event): void {
    event?.stopPropagation();
    this.iconPickerSectionId = '';
    this.iconPickerSearch = '';
    this.visibleIconOptions = [];
    this.iconPickerActiveLabel = 'Common icons';
    this.iconPickerActiveCount = 0;
  }

  protected setIconPickerGroup(group: HelpIconOption['group'], event?: Event): void {
    event?.stopPropagation();
    this.iconPickerGroup = group;
    this.refreshIconPickerOptions();
  }

  protected setIconPickerSearch(value: string): void {
    this.iconPickerSearch = value;
    this.refreshIconPickerOptions();
  }

  protected iconPickerGroupIcon(group: HelpIconOption['group']): string {
    switch (group) {
      case 'Planning':
        return 'event_note';
      case 'People':
        return 'groups';
      case 'Logistics':
        return 'inventory_2';
      case 'Safety':
        return 'verified_user';
      default:
        return 'apps';
    }
  }

  protected selectIcon(section: HelpEditorSectionDraft, icon: string, event?: Event): void {
    event?.stopPropagation();
    section.icon = icon;
    this.closeIconPicker();
  }

  protected iconPickerSection(): HelpEditorSectionDraft | null {
    return this.draft?.sections.find(section => section.localId === this.iconPickerSectionId) ?? null;
  }

  private refreshIconPickerOptions(): void {
    const query = this.iconPickerSearch.trim().toLowerCase();
    const options = query
      ? this.helpIconOptions
      : this.helpIconOptions.filter(option => option.group === this.iconPickerGroup);
    this.visibleIconOptions = options.filter(option => {
      if (!query) {
        return true;
      }
      return [
        option.icon,
        option.label,
        option.group,
        ...option.keywords
      ].some(value => value.toLowerCase().includes(query));
    });
    this.iconPickerActiveLabel = query ? 'Search results' : `${this.iconPickerGroup} icons`;
    this.iconPickerActiveCount = this.visibleIconOptions.length;
  }

  protected async saveDraft(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.draft || this.saving) {
      return;
    }
    if (this.documentKind === 'explanation' && !this.draft.contextKey) {
      this.error = this.selectedContentLanguageIsHungarian()
        ? 'Válassz képernyőt mentés előtt.'
        : 'Choose a canonical screen before saving.';
      return;
    }
    const request = {
      actorUserId: this.actorUserId(),
      baseRevisionId: this.draft.baseRevisionId,
      contextKey: this.documentKind === 'explanation' ? this.draft.contextKey : null,
      lang: this.selectedContentLang,
      title: this.draft.title,
      summary: this.draft.summary,
      description: this.draft.description,
      headerColor: this.draft.headerColor,
      sections: this.toSections(this.draft.sections)
    };
    this.saving = true;
    this.error = '';
    try {
      await this.withMinimumActionTime(this.helpCenter.saveRevision(request, this.documentKind));
      this.editing = false;
      this.draft = null;
      this.draftAccordionOpen = true;
      this.closeIconPicker();
      this.closeContextPicker();
      this.selectNewestRevision(this.revisions(), this.activeRevision());
    } catch {
      this.error = this.saveErrorLabel();
    } finally {
      this.saving = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  protected async activateRevision(revision: HelpCenterRevision, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (revision.active || this.saving || this.activatingRevisionId) {
      return;
    }
    this.activatingRevisionId = revision.id;
    this.error = '';
    try {
      await this.withMinimumActionTime(this.helpCenter.activateRevision(revision.id, this.actorUserId(), this.documentKind));
      this.selectInitialRevision(this.revisions(), this.activeRevision());
    } catch {
      this.error = this.activateErrorLabel();
    } finally {
      this.activatingRevisionId = '';
      this.changeDetectorRef.detectChanges();
    }
  }

  protected deleteRevision(revision: HelpCenterRevision, event?: Event): void {
    event?.stopPropagation();
    if (this.saving || this.activatingRevisionId) {
      return;
    }
    this.confirmationDialog.open({
      title: `Delete v${revision.version}?`,
      message: revision.title,
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.saving = true;
        this.error = '';
        try {
          await this.withMinimumActionTime(this.helpCenter.deleteRevision(revision.id, this.actorUserId(), this.documentKind));
          this.selectInitialRevision(this.revisions(), this.activeRevision());
        } catch {
          this.error = this.deleteErrorLabel();
        } finally {
          this.saving = false;
          this.changeDetectorRef.detectChanges();
        }
      }
    });
  }

  protected revisionSubtitle(revision: HelpCenterRevision): string {
    const count = revision.sections.length;
    return `${this.uiText(`${count} section${count === 1 ? '' : 's'}`)} · ${this.fullDate(revision.updatedAtIso || revision.createdAtIso)}`;
  }

  protected revisionDescription(revision: Pick<HelpCenterRevision, 'description'>): string {
    return revision.description?.trim() || this.defaultDescription();
  }

  protected nextRevisionVersion(): number {
    return this.revisions()
      .map(revision => Math.trunc(Number(revision.version) || 0))
      .reduce((max, version) => Math.max(max, version), 0) + 1;
  }

  protected draftVersionLabel(): string {
    const nextVersion = this.nextRevisionVersion();
    const baseRevision = this.draft?.baseRevisionId
      ? this.revisions().find(revision => revision.id === this.draft?.baseRevisionId)
      : null;
    return baseRevision ? `v${baseRevision.version} -> v${nextVersion}` : `v${nextVersion}`;
  }

  protected isAnyActionPending(): boolean {
    return this.saving || Boolean(this.activatingRevisionId);
  }

  protected loadingRingDashOffset(): number {
    return this.loadingRingPerimeter * (1 - this.loadingProgress());
  }

  protected fullDate(value: string): string {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return 'Just now';
    }
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(new Date(parsed));
  }

  protected actorUserId(): string {
    return this.admin.activeAdmin()?.id?.trim() || 'admin';
  }

  protected documentLabel(): string {
    switch (this.documentKind) {
      case 'privacy':
        return 'Privacy';
      case 'explanation':
        return 'Explanation';
      default:
        return 'Help';
    }
  }

  protected documentIcon(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'policy';
      case 'explanation':
        return 'tips_and_updates';
      default:
        return 'help_outline';
    }
  }

  protected documentLabelLower(): string {
    return this.documentLabel().toLowerCase();
  }

  protected editorTitle(): string {
    return this.uiText(`${this.documentLabel()} editor`);
  }

  protected uiDocumentLabel(): string {
    return this.uiText(this.documentLabel());
  }

  protected activeRevisionLabel(version: number | null | undefined): string {
    const normalizedVersion = Math.max(0, Math.trunc(Number(version) || 0));
    return this.uiText(`Active ${this.documentLabelLower()} v${normalizedVersion}`);
  }

  protected noActiveRevisionLabel(): string {
    return this.uiText(`No active ${this.documentLabelLower()} revision`);
  }

  protected loadingRevisionsLabel(): string {
    return this.uiText(`Loading ${this.documentLabelLower()} revisions`);
  }

  protected revisionsAriaLabel(): string {
    return this.uiText(`${this.documentLabel()} revisions`);
  }

  protected createRevisionLabel(): string {
    return this.uiText(`Create ${this.documentLabelLower()} revision`);
  }

  protected popupHeaderPlaceholder(): string {
    return this.uiText(`${this.documentLabel()} popup header`);
  }

  protected descriptionPlaceholder(): string {
    return this.uiText(`${this.documentLabel()} description`);
  }

  protected addSectionLabel(): string {
    return this.uiText(`Add ${this.documentLabelLower()} section`);
  }

  protected editableSectionsAriaLabel(): string {
    return this.uiText(`Editable ${this.documentLabelLower()} sections`);
  }

  protected sectionTitleAriaLabel(): string {
    return this.uiText(`${this.documentLabel()} section title`);
  }

  protected removeSectionLabel(): string {
    return this.uiText(`Remove ${this.documentLabelLower()} section`);
  }

  protected toggleSectionLabel(): string {
    return this.uiText(`Toggle ${this.documentLabelLower()} section`);
  }

  protected noRevisionsLabel(): string {
    return this.uiText(`No ${this.documentLabelLower()} revisions`);
  }

  protected createRevisionToEnablePopupLabel(): string {
    return this.uiText(`Create a revision to enable the ${this.documentLabelLower()} popup.`);
  }

  private loadErrorLabel(): string {
    return this.uiText(`Unable to load ${this.documentLabelLower()} revisions.`);
  }

  private saveErrorLabel(): string {
    return this.uiText(`Unable to save ${this.documentLabelLower()} revision.`);
  }

  private activateErrorLabel(): string {
    return this.uiText(`Unable to activate ${this.documentLabelLower()} revision.`);
  }

  private deleteErrorLabel(): string {
    return this.uiText(`Unable to delete ${this.documentLabelLower()} revision.`);
  }

  protected uiText(source: string): string {
    return this.i18n.translate(source);
  }

  protected defaultDescription(): string {
    switch (this.documentKind) {
      case 'privacy':
        return this.defaultPrivacyDescription;
      case 'explanation':
        return APP_STATIC_DATA.defaultExplanationHomeRevision.description;
      default:
        return this.defaultHelpDescription;
    }
  }

  protected defaultSectionIcon(): string {
    switch (this.documentKind) {
      case 'privacy':
        return 'policy';
      case 'explanation':
        return 'tips_and_updates';
      default:
        return 'help_outline';
    }
  }

  protected headerColorClass(color: string | null | undefined): string {
    return `help-editor-header-color-${this.normalizeHeaderColor(color)}`;
  }

  protected openColorPicker(event?: Event): void {
    event?.stopPropagation();
    this.colorPickerOpen = true;
    this.closeIconPicker();
    this.closeContextPicker();
  }

  protected closeColorPicker(event?: Event): void {
    event?.stopPropagation();
    this.colorPickerOpen = false;
  }

  protected selectHeaderColor(color: HelpCenterHeaderColor, event?: Event): void {
    event?.stopPropagation();
    if (this.draft) {
      this.draft.headerColor = color;
    }
    this.closeColorPicker();
  }

  private selectInitialRevision(revisions: HelpCenterRevision[], activeRevision: HelpCenterRevision | null): void {
    const selected = activeRevision ?? revisions[0] ?? null;
    this.selectedRevisionId = selected?.id ?? '';
    this.openRevisionId = selected?.id ?? '';
    this.openPreviewSectionId = selected?.sections[0]?.id ?? '';
  }

  private selectNewestRevision(revisions: HelpCenterRevision[], activeRevision: HelpCenterRevision | null): void {
    const newest = [...revisions].sort((left, right) => right.version - left.version)[0] ?? activeRevision ?? null;
    this.selectedRevisionId = newest?.id ?? '';
    this.openRevisionId = newest?.id ?? '';
    this.openPreviewSectionId = newest?.sections[0]?.id ?? '';
  }

  private revisionRow(revision: HelpCenterRevision): HelpEditorRevisionRow {
    return {
      id: `revision-${revision.id}`,
      kind: 'revision',
      revision
    };
  }

  private draftRow(): HelpEditorRevisionRow {
    return {
      id: 'draft',
      kind: 'draft',
      revision: null
    };
  }

  private beginEditingDraft(draft: HelpEditorRevisionDraft): void {
    this.draft = draft;
    this.draftAccordionOpen = true;
    this.openRevisionId = '';
    this.openPreviewSectionId = '';
    this.openDraftSectionId = draft.sections[0]?.localId ?? '';
    this.closeIconPicker();
    this.closeColorPicker();
    this.closeContextPicker();
    this.editing = true;
  }

  private draftFromRevision(revision: HelpCenterRevision): HelpEditorRevisionDraft {
    const contextKey = this.normalizeExplanationContextKey(revision.contextKey);
    if (this.documentKind === 'explanation') {
      this.selectedExplanationContextKey = contextKey;
    }
    return {
      baseRevisionId: revision.id,
      contextKey: this.documentKind === 'explanation' ? contextKey : null,
      title: revision.title,
      summary: revision.summary,
      description: revision.description?.trim() || this.defaultDescription(),
      headerColor: this.normalizeHeaderColor(revision.headerColor),
      sections: revision.sections.map(section => ({
        localId: this.newLocalId(),
        id: section.id?.trim() ?? '',
        icon: section.icon || this.defaultSectionIcon(),
        title: section.title?.trim() || this.defaultUntitledContentSectionTitle(),
        blurb: section.blurb,
        contentHtml: this.formatHtmlFragment(this.withoutSectionLayoutMarkers(this.sectionContentHtml(section))),
        imageUrls: this.normalizeSectionImageUrls(section.imageUrls),
        panelSpan: this.sectionPanelSpan(section) ?? 'span-1',
        optional: section.optional === true,
        mode: 'html'
      }))
    };
  }

  private emptyDraft(contextKeyOverride?: string | null): HelpEditorRevisionDraft {
    const contextKey = this.documentKind === 'explanation'
      ? (contextKeyOverride === undefined ? this.selectedExplanationContextKey : contextKeyOverride)
      : null;
    return {
      baseRevisionId: null,
      contextKey,
      title: this.defaultContentRevisionTitle(),
      summary: '',
      description: '',
      headerColor: this.documentKind === 'explanation' ? 'violet' : 'amber',
      sections: [
        {
          localId: this.newLocalId(),
          id: '',
          icon: this.defaultSectionIcon(),
          title: '',
          blurb: '',
          contentHtml: '',
          imageUrls: [],
          panelSpan: 'span-1',
          optional: false,
          mode: 'html'
        }
      ]
    };
  }

  private toSections(drafts: HelpEditorSectionDraft[]): HelpCenterSection[] {
    const seenIds = new Set<string>();
    return drafts
      .map((draft, index) => {
        const title = draft.title.trim() || this.defaultNumberedContentSectionTitle(index + 1);
        const baseId = this.slugify(draft.id) || this.slugify(title) || `section-${index + 1}`;
        let id = baseId;
        let duplicateIndex = 2;
        while (seenIds.has(id)) {
          id = `${baseId}-${duplicateIndex++}`;
        }
        seenIds.add(id);
        return {
          id,
          icon: draft.icon.trim() || this.defaultSectionIcon(),
          title,
          blurb: draft.blurb.trim(),
          contentHtml: this.withoutSectionLayoutMarkers(draft.contentHtml).trim(),
          imageUrls: this.normalizeSectionImageUrls(draft.imageUrls),
          panelSpan: this.normalizeSectionPanelSpan(draft.panelSpan) ?? 'span-1',
          optional: this.documentKind === 'privacy' && draft.optional === true
        };
      })
      .filter(section => section.contentHtml.length > 0);
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private newLocalId(): string {
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private defaultContentRevisionTitle(): string {
    if (this.documentKind === 'explanation') {
      return this.nextGeneratedExplanationTitle();
    }
    if (this.selectedContentLanguageIsHungarian()) {
      return this.documentKind === 'privacy' ? 'Új adatvédelmi verzió' : 'Új súgóverzió';
    }
    return `New ${this.documentLabelLower()} revision`;
  }

  private defaultContentSectionTitle(): string {
    if (this.documentKind === 'explanation') {
      return this.selectedContentLanguageIsHungarian() ? 'Új magyarázat szakasz' : 'New explanation section';
    }
    if (this.selectedContentLanguageIsHungarian()) {
      return this.documentKind === 'privacy' ? 'Új adatvédelmi szakasz' : 'Új súgó szakasz';
    }
    return `New ${this.documentLabelLower()} section`;
  }

  protected defaultUntitledContentSectionTitle(): string {
    if (this.documentKind === 'explanation') {
      return this.selectedContentLanguageIsHungarian() ? 'Névtelen magyarázat szakasz' : 'Untitled explanation section';
    }
    if (this.selectedContentLanguageIsHungarian()) {
      return this.documentKind === 'privacy' ? 'Névtelen adatvédelmi szakasz' : 'Névtelen súgó szakasz';
    }
    return `Untitled ${this.documentLabelLower()} section`;
  }

  private defaultNumberedContentSectionTitle(index: number): string {
    if (this.documentKind === 'explanation') {
      return this.selectedContentLanguageIsHungarian() ? `Magyarázat szakasz ${index}` : `Explanation section ${index}`;
    }
    if (this.selectedContentLanguageIsHungarian()) {
      return this.documentKind === 'privacy' ? `Adatvédelmi szakasz ${index}` : `Súgó szakasz ${index}`;
    }
    return `${this.documentLabel()} section ${index}`;
  }

  private defaultContentSectionHtml(): string {
    if (this.documentKind === 'explanation') {
      return this.selectedContentLanguageIsHungarian()
        ? '<p>Írd le, mit érdemes tudni erről a képernyőről.</p>'
        : '<p>Describe what the user should know on this screen.</p>';
    }
    if (this.selectedContentLanguageIsHungarian()) {
      return this.documentKind === 'privacy'
        ? '<p>Írd le ezt az adatvédelmi szakaszt.</p>'
        : '<p>Írd le ezt a súgó szakaszt.</p>';
    }
    return `<p>Describe this ${this.documentLabelLower()} section.</p>`;
  }

  private selectedContentLanguageIsHungarian(): boolean {
    return this.normalizeContentLang(this.selectedContentLang) === 'hu';
  }

  private nextGeneratedExplanationTitle(): string {
    const existingNumbers = this.currentState()?.revisions
      ?.map(revision => revision.title?.trim() ?? '')
      ?.map(title => /^New item (\d+)$/i.exec(title)?.[1] ?? null)
      ?.filter((value): value is string => Boolean(value))
      ?.map(value => Number(value))
      ?.filter(value => Number.isFinite(value) && value > 0) ?? [];
    const nextIndex = existingNumbers.reduce((max, value) => Math.max(max, value), 0) + 1;
    return `New item ${nextIndex}`;
  }

  private explanationRevisionForSurface(surface: ExplainableSurface): HelpCenterRevision | null {
    return this.helpCenter.explanationState()?.revisions
      ?.filter(revision => this.normalizeExplanationContextKey(revision.contextKey) === surface.key)
      ?.sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1;
        }
        return right.version - left.version;
      })[0] ?? null;
  }

  private normalizeExplanationContextKey(contextKey: string | null | undefined): string {
    const normalized = `${contextKey ?? ''}`.trim();
    return this.explainableSurfaces().find(surface => surface.key === normalized)?.key
      ?? this.explainableSurfaces()[0]?.key
      ?? 'home.game';
  }

  private sectionPanelSpan(section: { id?: string | null; contentHtml?: string | null; panelSpan?: string | null; panelLayout?: string | null }): HelpCenterSectionPanelSpan | null {
    return this.normalizeSectionPanelSpan(section.panelSpan)
      ?? this.normalizeSectionPanelSpan(section.panelLayout)
      ?? this.sectionLayoutMarker(section.contentHtml ?? '')
      ?? (AdminHelpEditorPopupComponent.FALLBACK_SPAN_2_SECTION_IDS.has(`${section.id ?? ''}`) ? 'span-2' : null);
  }

  private sectionLayoutMarker(contentHtml: string): HelpCenterSectionPanelSpan | null {
    const marker = /<!--\s*(?:panel|layout|section|width)\s*:\s*([a-z0-9_-]+)\s*-->/i.exec(contentHtml)?.[1]
      ?? /\b(?:data-panel|data-layout|data-section|data-width|data-panel-width)\s*=\s*["']\s*([a-z0-9_-]+)\s*["']/i.exec(contentHtml)?.[1]
      ?? /\b(?:help|explanation|section|panel)-(?:panel|section|layout)--([a-z0-9_-]+)\b/i.exec(contentHtml)?.[1];
    return this.normalizeSectionPanelSpan(marker);
  }

  private normalizeSectionPanelSpan(value: string | null | undefined): HelpCenterSectionPanelSpan | null {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'span-1' || normalized === 'compact' || normalized === 'single' || normalized === 'one' || normalized === '1') {
      return 'span-1';
    }
    if (normalized === 'span-2' || normalized === 'wide' || normalized === 'double' || normalized === 'two' || normalized === '2') {
      return 'span-2';
    }
    if (normalized === 'span-3' || normalized === 'full' || normalized === 'row' || normalized === 'all' || normalized === '3') {
      return 'span-3';
    }
    return null;
  }

  private withoutSectionLayoutMarkers(contentHtml: string): string {
    return `${contentHtml ?? ''}`
      .replace(/<!--\s*(?:panel|layout|section|width)\s*:\s*[a-z0-9_-]+\s*-->\s*/gi, '')
      .trim();
  }

  private sectionContentHtml(section: HelpCenterSection): string {
    const contentHtml = `${section.contentHtml ?? ''}`.trim();
    if (contentHtml) {
      return contentHtml;
    }
    const details = Array.isArray(section.details) ? section.details : [];
    const points = Array.isArray(section.points) ? section.points : [];
    return [
      section.blurb ? `<p><strong>${this.escapeHtml(section.blurb)}</strong></p>` : '',
      ...details.map(detail => `<p>${this.escapeHtml(detail)}</p>`),
      points.length ? `<ul>${points.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}</ul>` : ''
    ].join('\n');
  }

  private normalizeSectionImageUrls(imageUrls: readonly string[] | null | undefined): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const imageUrl of imageUrls ?? []) {
      const normalized = `${imageUrl ?? ''}`.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= this.explanationImageSlotCount) {
        break;
      }
    }
    return result;
  }

  private htmlFromClipboardPayload(html: string, text: string): string {
    const normalizedHtml = `${html ?? ''}`.trim();
    if (normalizedHtml) {
      return normalizedHtml;
    }
    const normalizedText = `${text ?? ''}`.trim();
    if (this.isEmbeddableImageUrl(normalizedText)) {
      return `<img src="${this.escapeHtmlAttribute(normalizedText)}" alt="">`;
    }
    return text;
  }

  private isEmbeddableImageUrl(value: string): boolean {
    const normalized = `${value ?? ''}`.trim();
    return /^data:image\//i.test(normalized)
      || /^blob:https?:\/\//i.test(normalized)
      || /^blob:/i.test(normalized)
      || /^indexeddb:/i.test(normalized)
      || /^\/(?:api\/)?media\/public\?[^\s<>"']+$/i.test(normalized)
      || /^https?:\/\/[^\s<>"']+\/(?:api\/)?media\/public\?[^\s<>"']+$/i.test(normalized)
      || /^https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?$/i.test(normalized);
  }

  private normalizeHeaderColor(value: string | null | undefined): HelpCenterHeaderColor {
    switch (`${value ?? ''}`.trim()) {
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
        return value as HelpCenterHeaderColor;
      default:
        return 'amber';
    }
  }

  private normalizeContentLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private escapeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatHtmlFragment(value: string): string {
    const html = `${value ?? ''}`.trim();
    if (!html || typeof document === 'undefined') {
      return html;
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    return this.formatHtmlNodes(Array.from(template.content.childNodes), 0).join('\n').trim();
  }

  private formatHtmlNodes(nodes: ChildNode[], depth: number): string[] {
    return nodes.flatMap(node => this.formatHtmlNode(node, depth)).filter(line => line.trim().length > 0);
  }

  private formatHtmlNode(node: ChildNode, depth: number): string[] {
    const indent = '  '.repeat(depth);
    if (node.nodeType === 3) {
      const text = this.normalizedHtmlText(node.textContent ?? '');
      return text ? [`${indent}${this.escapeHtml(text)}`] : [];
    }
    if (node.nodeType === 8) {
      const text = `${node.textContent ?? ''}`.trim();
      return text ? [`${indent}<!-- ${text} -->`] : [];
    }
    if (!(node instanceof HTMLElement)) {
      return [];
    }

    const tagName = node.tagName.toLowerCase();
    const attributes = this.htmlAttributes(node);
    if (AdminHelpEditorPopupComponent.VOID_HTML_TAGS.has(tagName)) {
      return [`${indent}<${tagName}${attributes}>`];
    }

    const children = this.meaningfulHtmlChildren(node);
    if (children.length === 0) {
      return [`${indent}<${tagName}${attributes}></${tagName}>`];
    }

    if (children.length === 1 && children[0].nodeType === 3) {
      const text = this.normalizedHtmlText(children[0].textContent ?? '');
      return [`${indent}<${tagName}${attributes}>${this.escapeHtml(text)}</${tagName}>`];
    }

    return [
      `${indent}<${tagName}${attributes}>`,
      ...this.formatHtmlNodes(children, depth + 1),
      `${indent}</${tagName}>`
    ];
  }

  private meaningfulHtmlChildren(element: HTMLElement): ChildNode[] {
    return Array.from(element.childNodes).filter(node => node.nodeType !== 3 || `${node.textContent ?? ''}`.trim().length > 0);
  }

  private htmlAttributes(element: HTMLElement): string {
    return Array.from(element.attributes)
      .map(attribute => ` ${attribute.name}="${this.escapeHtmlAttribute(attribute.value)}"`)
      .join('');
  }

  private lazyImagePlaceholderSrc(imageUrl: string): string {
    return `${AdminHelpEditorPopupComponent.LAZY_IMAGE_PLACEHOLDER_URL}#lazy-src=${encodeURIComponent(imageUrl)}`;
  }

  private escapeHtmlAttribute(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private normalizedHtmlText(value: string): string {
    return `${value ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  private adminContentRoute(): string {
    switch (this.documentKind) {
      case 'privacy':
        return '/admin/privacy';
      case 'explanation':
        return this.selectedExplanationContextKey
          ? `/admin/explanation/${this.selectedExplanationContextKey}`
          : '/admin/explanation/new';
      default:
        return '/admin/help';
    }
  }

  private completeLoadingAfterCheck(): void {
    this.clearLoadingCompletionTimer();
    this.loadingCompletionTimer = setTimeout(() => {
      this.loadingCompletionTimer = null;
      this.loading.set(false);
      this.changeDetectorRef.detectChanges();
    }, 0);
  }

  private beginLoadingProgress(): void {
    this.loadingProgressStartedAtMs = this.nowMs();
    this.loadingProgress.set(0);
    this.updateLoadingProgress();
  }

  private updateLoadingProgress(): void {
    const elapsed = this.nowMs() - this.loadingProgressStartedAtMs;
    const progress = Math.min(0.92, elapsed / AdminHelpEditorPopupComponent.LOAD_PROGRESS_WINDOW_MS);
    this.loadingProgress.set(progress);
    this.clearLoadingProgressTimer();
    this.loadingProgressTimer = setTimeout(() => this.updateLoadingProgress(), 80);
  }

  private endLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgress.set(1);
  }

  private clearLoadingProgress(): void {
    this.clearLoadingProgressTimer();
    this.loadingProgressStartedAtMs = 0;
    this.loadingProgress.set(0);
  }

  private clearLoadingProgressTimer(): void {
    if (!this.loadingProgressTimer) {
      return;
    }
    clearTimeout(this.loadingProgressTimer);
    this.loadingProgressTimer = null;
  }

  private clearLoadingCompletionTimer(): void {
    if (!this.loadingCompletionTimer) {
      return;
    }
    clearTimeout(this.loadingCompletionTimer);
    this.loadingCompletionTimer = null;
  }

  private async withMinimumActionTime<T>(action: Promise<T>): Promise<T> {
    const [result] = await Promise.all([
      action,
      this.routeDelay.waitForDelay(AdminHelpEditorPopupComponent.ACTION_PENDING_WINDOW_MS)
    ]);
    return result;
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }
}
