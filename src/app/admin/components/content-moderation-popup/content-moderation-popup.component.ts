import { ChangeDetectionStrategy, Component, ViewChild, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { from } from 'rxjs';
import { AppMenuComponent, PopupComponent, SmartListComponent, SingleRowComponent, I18nPipe, type PopupModel, type AppMenuItem, type AppMenuItemSelectEvent, type AppMenuPalette, type SmartListConfig, type SmartListLoadPage, type SingleRowData } from '../../../shared/ui';
import { ContentModerationService } from '../../../shared/core/base/services/content-moderation.service';
import { MODERATION_CATEGORIES, MODERATION_STATUSES, moderationCount, moderationDecisionAllowed, type ContentModerationItem, type ContentModerationSettings, type ModerationCategory, type ModerationCategoryFilter, type ModerationStatus } from '../../../shared/core/contracts/content-moderation.interface';
import { AdminMenuStore } from '../../../shared/ui/context/stores/admin-menu.store';
import { AdminWorkspaceStore } from '../../../shared/ui/context/stores/admin-workspace.store';
import { ContentModerationStore } from '../../../shared/ui/context/stores/content-moderation.store';
import { DialogStore } from '../../../shared/ui/context/stores/dialog.store';
import { ImageGalleryStore } from '../../../shared/ui/context/stores/image-gallery.store';
import { EventEditorPopupStore } from '../../../shared/ui/context/stores/event-editor-popup.store';
import { AssetStore } from '../../../shared/ui/context/stores/asset.store';
import { AssetPopupStore } from '../../../shared/ui/context/stores/asset-popup.store';
import { AssetCardBuilder } from '../../../shared/core/base/builders/asset-card.builder';
import type { AssetDetailDTO } from '../../../shared/core/contracts/asset.interface';
import type { PhotoFeedPost } from '../../../shared/core/contracts/photo-feed.interface';
import type { ActivityEventDetailDTO } from '../../../shared/core/contracts/activity.interface';
import { MODERATION_STATUS_STYLE as STATUS_STYLE } from '../../../shared/ui/converters/content-moderation-presentation';
import { CommunityGroupEditorComponent } from '../../../shared/ui/components/community-groups-popup/community-group-editor.component';
import { CommunityGroupsStore } from '../../../shared/ui/context/stores/community-groups.store';
import type { CommunityGroup } from '../../../shared/core/contracts/community-group.interface';

const CATEGORY_FILTERS: readonly ModerationCategoryFilter[] = ['all', 'event', 'asset', 'feed', 'group'];
const CATEGORY_STYLE: Record<ModerationCategoryFilter, { icon: string; palette: AppMenuPalette }> = {
  all: { icon: 'apps', palette: 'slate' },
  group: { icon: 'groups', palette: 'lime' },
  asset: { icon: 'inventory_2', palette: 'green' }, event: { icon: 'event', palette: 'blue' }, feed: { icon: 'photo_library', palette: 'orange' }
};
@Component({
  selector: 'app-content-moderation-popup', standalone: true,
  imports: [FormsModule, PopupComponent, AppMenuComponent, SmartListComponent, SingleRowComponent, I18nPipe, CommunityGroupEditorComponent],
  templateUrl: './content-moderation-popup.component.html', styleUrl: './content-moderation-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentModerationPopupComponent {
  protected readonly adminMenu = inject(AdminMenuStore);
  protected readonly state = inject(ContentModerationStore);
  private readonly workspace = inject(AdminWorkspaceStore);
  private readonly service = inject(ContentModerationService);
  private readonly i18n = inject(I18nService);
  private readonly dialogs = inject(DialogStore);
  private readonly gallery = inject(ImageGalleryStore);
  private readonly eventEditor = inject(EventEditorPopupStore);
  private readonly assetEditor = inject(AssetStore);
  private readonly assetPopup = inject(AssetPopupStore);
  protected readonly groups = inject(CommunityGroupsStore);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<ContentModerationItem>;
  protected category: ModerationCategoryFilter = 'all';
  protected status: ModerationStatus = 'under-review';
  protected query = { filters: { category: this.category, status: this.status } };
  protected readonly settingsDraft = signal<ContentModerationSettings | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  private settingsRevision = 0;
  private get admin() { return this.workspace.dashboard()?.activeAdmin; }
  protected readonly config: SmartListConfig<ContentModerationItem> = {
    pageSize: 20, initialPageSize: 20, listLayout: 'stack', snapMode: 'none', emptyLabel: 'moderation.empty',
    pollIntervalMs: 10000,
    groupBy: item => item.submittedAtIso.slice(0, 10), showStickyHeader: true,
    showFirstGroupMarker: false, showGroupMarker: ({ groupIndex }) => groupIndex > 0,
    trackBy: (_index, item) => item.id,
    menuItems: context => context.item && this.state.snapshot()?.settings.enabled ? MODERATION_STATUSES.filter(status => moderationDecisionAllowed(context.item!, status)).map(status => ({ id: status, label: this.decisionLabel(context.item!, status),
      ...STATUS_STYLE[status], surface: 'tinted', disabled: status === context.item!.status, context: context.item })) : []
  };
  protected readonly loadPage: SmartListLoadPage<ContentModerationItem> = query => from(this.load(query));
  constructor() {
    effect(() => {
      if (this.adminMenu.activePopup() === 'content-moderation') {
        this.query = { filters: { category: this.category, status: this.status } }; this.error.set(false);
      }
    });
  }
  private async load(query: Parameters<SmartListLoadPage<ContentModerationItem>>[0]) {
    const { category, status } = query.filters as { category: ModerationCategoryFilter; status: ModerationStatus };
    try {
      const result = await this.service.page(this.admin?.id ?? '', category, status, query);
      this.error.set(false);
      this.state.apply(result.snapshot); return result;
    } catch (error) {
      this.error.set(true);
      throw error;
    }
  }
  protected model(): PopupModel {
    return { title: 'moderation.title', size: 'wide', height: 'full', bodyLayout: 'fill', headerTone: 'accent',
      headerActions: [{ id: 'settings', icon: 'settings', ariaLabel: 'moderation.settings', palette: 'blue' }],
      toolbarControls: [
        { kind: 'menu', id: 'status', align: 'start', menuKind: 'select', trigger: {
            label: `moderation.status.${this.status}`, ...STATUS_STYLE[this.status],
            counter: { value: moderationCount(this.state.snapshot(), this.category, this.status), max: 9999 } },
          items: MODERATION_STATUSES.map(id => ({ id: `status:${id}`, label: `moderation.status.${id}`, ...STATUS_STYLE[id], surface: 'tinted', active: id === this.status,
            counter: { value: moderationCount(this.state.snapshot(), this.category, id), max: 9999 } })) },
        { kind: 'menu', id: 'category', align: 'end', menuKind: 'select', trigger: { label: `moderation.category.${this.category}`, ...CATEGORY_STYLE[this.category] },
          items: CATEGORY_FILTERS.map(id => ({ id: `category:${id}`, label: `moderation.category.${id}`, ...CATEGORY_STYLE[id], surface: 'tinted', active: id === this.category,
            counter: { value: moderationCount(this.state.snapshot(), id, this.status), max: 9999 } })) }
      ], onClose: () => this.adminMenu.closePopup(), onAction: () => this.openSettings(),
      onMenuSelect: event => {
        const id = String(event.itemSelect.id);
        if (id.startsWith('category:')) this.category = id.slice(9) as ModerationCategoryFilter;
        if (id.startsWith('status:')) this.status = id.slice(7) as ModerationStatus;
        this.query = { filters: { category: this.category, status: this.status } };
      }
    };
  }
  protected row(item: ContentModerationItem): SingleRowData {
    return { id: item.id, title: item.title, subtitle: `moderation.category.${item.category}`, avatarUrl: item.imageUrl || null,
      detail: item.submittedAtIso, menuActions: this.state.snapshot()?.settings.enabled ? ['moderation'] : [], menuPosition: 'top-right', surfaceTone: item.category === 'feed' ? 'warning' : item.category === 'asset' ? 'success' : 'info' };
  }
  private decisionLabel(item: ContentModerationItem, status: ModerationStatus): string {
    return item.status === 'blocked' && status === 'under-review' ? 'moderation.unblock' : `moderation.status.${status}`;
  }
  protected decide(event: AppMenuItemSelectEvent): void {
    const item = event.context as ContentModerationItem;
    const status = event.id as ModerationStatus;
    if (!this.state.snapshot()?.settings.enabled || !item || !MODERATION_STATUSES.includes(status) || !moderationDecisionAllowed(item, status)) return;
    const commandId = crypto.randomUUID();
    this.dialogs.open({ title: this.decisionLabel(item, status), message: item.title,
      cancelLabel: 'cancel', confirmLabel: 'confirm', busyConfirmLabel: 'saving', failureMessage: 'moderation.failed',
      confirmPalette: STATUS_STYLE[status].palette,
      input: ['rejected', 'blocked'].includes(status) ? { label: 'moderation.message', maxLength: 1000 } : null,
      onConfirm: async message => {
        const result = await this.service.decide(item.id, { adminUserId: this.admin?.id ?? '', commandId,
          expectedVersion: item.version, status, message }, this.admin);
        this.state.apply(result.snapshot);
        const saved = result.item;
        const matches = saved.status === this.status && (this.category === 'all' || saved.category === this.category);
        if (matches) this.list?.patchVisibleItem(row => row.id === saved.id, saved);
        else this.list?.removeVisibleItems(row => row.id === saved.id, { totalDelta: -1 });
      }
    });
  }
  protected async openItem(item: ContentModerationItem): Promise<void> {
    this.error.set(false);
    try {
      if (item.category === 'feed') {
        const post = await this.service.detail<PhotoFeedPost>(this.admin?.id ?? '', item.id);
        this.gallery.open({ images: post.imageUrls, imageDetails: post.imageDetails, slotCount: 5, readOnly: true,
          title: item.title, uploadOwnerId: post.creatorUserId, uploadEntityId: post.id });
      } else if (item.category === 'group') this.groups.editor.set({ group: await this.service.detail<CommunityGroup>(this.admin?.id ?? '', item.id), readOnly: true });
      else if (item.category === 'event') this.eventEditor.openView(await this.service.detail<ActivityEventDetailDTO>(this.admin?.id ?? '', item.id));
      else {
        const asset = await this.service.detail<AssetDetailDTO>(this.admin?.id ?? '', item.id);
        this.assetEditor.openAssetEditorEdit({ cardId: asset.id, form: AssetCardBuilder.buildAssetFormFromCard(asset),
          visibility: AssetCardBuilder.visibilityFromCard(asset), readOnly: true, loading: false, parentZIndex: 2470 });
        await this.assetPopup.ensureAssetPopupLoaded();
      }
    } catch { this.error.set(true); }
  }
  private async openSettings() {
    this.error.set(false);
    try { const snapshot = await this.service.snapshot(this.admin?.id ?? ''); this.state.apply(snapshot);
      this.settingsRevision = snapshot.revision; this.settingsDraft.set({ ...snapshot.settings, enabled: snapshot.settings.enabled === true, categories: [...snapshot.settings.categories] });
    } catch { this.error.set(true); }
  }
  protected settingsModel(): PopupModel {
    return { title: 'moderation.settings', size: 'small', height: 'auto', bodyLayout: 'overflow',
      headerControls: [{ kind: 'menu', id: 'save', menuKind: 'inline', items: [{ id: 'save', icon: 'check', palette: 'green',
        ariaLabel: 'save', disabled: this.saving(), progress: this.saving() ? { state: 'loading', shape: 'circle' } : null }] }],
      onClose: () => { if (!this.saving()) this.settingsDraft.set(null); }, onMenuSelect: () => this.saveSettings() };
  }
  protected autoItems(): readonly AppMenuItem[] {
    return [{ id: 'auto', label: 'moderation.autoApprove', icon: 'verified', palette: 'green', kind: 'toggle', layout: 'pill',
      showToggleIndicator: true, closeOnSelect: false, checked: this.settingsDraft()?.autoApprove, disabled: this.saving() || !this.settingsDraft()?.enabled }];
  }
  protected enabledItems(): readonly AppMenuItem[] {
    return [{ id: 'enabled', label: 'moderation.title', icon: 'fact_check', palette: 'orange', kind: 'toggle', layout: 'pill',
      showToggleIndicator: true, closeOnSelect: false, checked: this.settingsDraft()?.enabled === true, disabled: this.saving() }];
  }
  protected toggleEnabled() { this.settingsDraft.update(value => value && ({ ...value, enabled: !value.enabled })); }
  protected toggleAuto() {
    if (!this.saving() && this.settingsDraft()?.enabled) this.settingsDraft.update(value => value && ({ ...value, autoApprove: !value.autoApprove }));
  }
  protected delay(value: number) {
    if (!this.saving() && this.settingsDraft()?.enabled && this.settingsDraft()?.autoApprove) {
      this.settingsDraft.update(draft => draft && ({ ...draft, delayMinutes: value }));
    }
  }
  protected categoryItems(): readonly AppMenuItem[] {
    return MODERATION_CATEGORIES.map(id => ({ id, label: `moderation.category.${id}`, ...CATEGORY_STYLE[id], surface: 'tinted', kind: 'checkbox',
      closeOnSelect: false, checked: this.settingsDraft()?.categories.includes(id), disabled: this.saving() || !this.settingsDraft()?.enabled }));
  }
  protected selectedCategoriesLabel(): string {
    const categories = this.settingsDraft()?.categories ?? [];
    if (categories.length === MODERATION_CATEGORIES.length) return 'moderation.category.all';
    if (!categories.length) return 'select.option';
    return categories.map(id => this.i18n.translate(`moderation.category.${id}`)).join(', ');
  }
  protected toggleCategory(event: AppMenuItemSelectEvent) {
    if (this.saving() || !this.settingsDraft()?.enabled) return;
    const id = event.id as ModerationCategory;
    this.settingsDraft.update(draft => draft && ({ ...draft, categories: draft.categories.includes(id)
      ? draft.categories.filter(value => value !== id) : [...draft.categories, id] }));
  }
  private async saveSettings() {
    const settings = this.settingsDraft(); if (!settings || this.saving()) return;
    this.saving.set(true); this.error.set(false);
    try {
      this.state.apply(await this.service.settings(this.admin?.id ?? '', this.settingsRevision, settings));
      this.settingsDraft.set(null);
    }
    catch { this.error.set(true); } finally { this.saving.set(false); }
  }
}
