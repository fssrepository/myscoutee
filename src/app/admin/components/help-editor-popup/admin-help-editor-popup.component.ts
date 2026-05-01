import { CommonModule } from '@angular/common';
import { Component, HostListener, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterRevision, HelpCenterSection } from '../../../shared/core/base/models';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import { AdminService } from '../../admin.service';

type EditorTab = 'html' | 'preview';

interface HelpIconOption {
  icon: string;
  label: string;
  group: 'Common' | 'Planning' | 'People' | 'Logistics' | 'Safety';
  keywords: string[];
}

interface HelpEditorSectionDraft {
  localId: string;
  icon: string;
  title: string;
  blurb: string;
  contentHtml: string;
  mode: EditorTab;
}

interface HelpEditorRevisionDraft {
  baseRevisionId: string | null;
  title: string;
  summary: string;
  description: string;
  sections: HelpEditorSectionDraft[];
}

@Component({
  selector: 'app-admin-help-editor-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-help-editor-popup.component.html',
  styleUrl: './admin-help-editor-popup.component.scss'
})
export class AdminHelpEditorPopupComponent {
  private static readonly ACTION_PENDING_WINDOW_MS = 1500;
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
  private readonly confirmationDialog = inject(ConfirmationDialogService);

  protected readonly helpState = this.helpCenter.state;
  protected loading = false;
  protected saving = false;
  protected activatingRevisionId = '';
  protected error = '';
  protected selectedRevisionId = '';
  protected openRevisionId = '';
  protected openPreviewSectionId = '';
  protected editing = false;
  protected draft: HelpEditorRevisionDraft | null = null;
  protected openDraftSectionId = '';
  protected iconPickerSectionId = '';
  protected iconPickerSearch = '';
  protected iconPickerGroup: HelpIconOption['group'] = 'Common';
  private stateLoadedForPopup = false;
  protected readonly actionRingPerimeter = 100;
  protected readonly defaultHelpDescription = APP_STATIC_DATA.defaultHelpCenterDescription;
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

  constructor() {
    effect(() => {
      if (this.admin.activePopup() !== 'help-editor') {
        this.stateLoadedForPopup = false;
        this.editing = false;
        this.draft = null;
        this.closeIconPicker();
        return;
      }
      if (!this.stateLoadedForPopup) {
        this.stateLoadedForPopup = true;
        void this.load();
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.iconPickerSectionId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeIconPicker();
  }

  protected async load(): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      const state = await this.helpCenter.loadAdminState(this.actorUserId());
      this.selectInitialRevision(state.revisions, state.activeRevision);
    } catch {
      this.error = 'Unable to load help revisions.';
    } finally {
      this.loading = false;
    }
  }

  protected close(): void {
    this.editing = false;
    this.draft = null;
    this.closeIconPicker();
    this.admin.closePopup();
  }

  protected revisions(): HelpCenterRevision[] {
    return this.helpState()?.revisions ?? [];
  }

  protected activeRevision(): HelpCenterRevision | null {
    return this.helpState()?.activeRevision ?? null;
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
    if (this.editing) {
      this.editing = false;
      this.draft = null;
      this.closeIconPicker();
    }
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
    this.openRevisionId = revision.id;
    this.openPreviewSectionId = revision.sections[0]?.id ?? '';
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
    this.error = '';
    this.closeIconPicker();
  }

  protected addDraftSection(event?: Event): void {
    event?.stopPropagation();
    if (!this.draft) {
      return;
    }
    const next: HelpEditorSectionDraft = {
      localId: this.newLocalId(),
      icon: 'help_outline',
      title: 'New help section',
      blurb: '',
      contentHtml: '<p>Describe this help section.</p>',
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
    this.openDraftSectionId = this.openDraftSectionId === section.localId ? '' : section.localId;
  }

  protected toggleDraftSectionMode(section: HelpEditorSectionDraft, event?: Event): void {
    event?.stopPropagation();
    if (this.openDraftSectionId !== section.localId) {
      this.openDraftSectionId = section.localId;
      this.closeIconPicker();
    }
    section.mode = section.mode === 'html' ? 'preview' : 'html';
  }

  protected formatPastedSectionHtml(section: HelpEditorSectionDraft, event: ClipboardEvent): void {
    event.stopPropagation();
    const pasted = event.clipboardData?.getData('text/html')
      || event.clipboardData?.getData('text/plain')
      || '';
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
    event?.stopPropagation();
    if (!this.draft || this.saving) {
      return;
    }
    const sections = this.toSections(this.draft.sections);
    this.saving = true;
    this.error = '';
    try {
      const state = await this.withMinimumActionTime(this.helpCenter.saveRevision({
        actorUserId: this.actorUserId(),
        baseRevisionId: this.draft.baseRevisionId,
        title: this.draft.title,
        summary: this.draft.summary,
        description: this.draft.description,
        sections
      }));
      this.editing = false;
      this.draft = null;
      this.closeIconPicker();
      this.selectNewestRevision(state.revisions, state.activeRevision);
    } catch {
      this.error = 'Unable to save help revision.';
    } finally {
      this.saving = false;
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
      const state = await this.withMinimumActionTime(this.helpCenter.activateRevision(revision.id, this.actorUserId()));
      this.selectInitialRevision(state.revisions, state.activeRevision);
    } catch {
      this.error = 'Unable to activate help revision.';
    } finally {
      this.activatingRevisionId = '';
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
          const state = await this.helpCenter.deleteRevision(revision.id, this.actorUserId());
          this.selectInitialRevision(state.revisions, state.activeRevision);
        } catch {
          this.error = 'Unable to delete help revision.';
        } finally {
          this.saving = false;
        }
      }
    });
  }

  protected revisionSubtitle(revision: HelpCenterRevision): string {
    return `${revision.sections.length} section${revision.sections.length === 1 ? '' : 's'} · ${this.fullDate(revision.updatedAtIso || revision.createdAtIso)}`;
  }

  protected revisionDescription(revision: Pick<HelpCenterRevision, 'description'>): string {
    return revision.description?.trim() || this.defaultHelpDescription;
  }

  protected nextRevisionVersion(): number {
    return this.revisions()
      .map(revision => Math.trunc(Number(revision.version) || 0))
      .reduce((max, version) => Math.max(max, version), 0) + 1;
  }

  protected isAnyActionPending(): boolean {
    return this.saving || Boolean(this.activatingRevisionId);
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

  private beginEditingDraft(draft: HelpEditorRevisionDraft): void {
    this.draft = draft;
    this.openDraftSectionId = draft.sections[0]?.localId ?? '';
    this.closeIconPicker();
    this.editing = true;
  }

  private draftFromRevision(revision: HelpCenterRevision): HelpEditorRevisionDraft {
    return {
      baseRevisionId: revision.id,
      title: revision.title,
      summary: revision.summary,
      description: revision.description?.trim() || this.defaultHelpDescription,
      sections: revision.sections.map(section => ({
        localId: this.newLocalId(),
        icon: section.icon || 'help_outline',
        title: section.title?.trim() || 'Untitled help section',
        blurb: section.blurb,
        contentHtml: this.formatHtmlFragment(this.sectionContentHtml(section)),
        mode: 'html'
      }))
    };
  }

  private emptyDraft(): HelpEditorRevisionDraft {
    return {
      baseRevisionId: null,
      title: 'New help revision',
      summary: '',
      description: '',
      sections: [
        {
          localId: this.newLocalId(),
          icon: 'help_outline',
          title: '',
          blurb: '',
          contentHtml: '',
          mode: 'html'
        }
      ]
    };
  }

  private toSections(drafts: HelpEditorSectionDraft[]): HelpCenterSection[] {
    const seenIds = new Set<string>();
    return drafts
      .map((draft, index) => {
        const title = draft.title.trim() || `Help section ${index + 1}`;
        const baseId = this.slugify(title) || `section-${index + 1}`;
        let id = baseId;
        let duplicateIndex = 2;
        while (seenIds.has(id)) {
          id = `${baseId}-${duplicateIndex++}`;
        }
        seenIds.add(id);
        return {
          id,
          icon: draft.icon.trim() || 'help_outline',
          title,
          blurb: draft.blurb.trim(),
          contentHtml: draft.contentHtml.trim()
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

  private async withMinimumActionTime<T>(action: Promise<T>): Promise<T> {
    const [result] = await Promise.all([
      action,
      new Promise(resolve => setTimeout(resolve, AdminHelpEditorPopupComponent.ACTION_PENDING_WINDOW_MS))
    ]);
    return result;
  }
}
