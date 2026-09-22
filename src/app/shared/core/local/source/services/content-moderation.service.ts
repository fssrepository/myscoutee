import { Injectable, inject } from '@angular/core';
import type { AdminUserDto } from '../../../contracts/admin.interface';
import type { ContentModerationDecision, ContentModerationSettings, ModerationCategoryFilter, ModerationStatus } from '../../../contracts/content-moderation.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import { LocalContentModerationRepository } from '../repositories/content-moderation.repository';
import { LocalAssetsService } from './assets.service';
import { LocalEventsService } from './events.service';
import { LocalPhotoFeedRepository } from '../repositories/photo-feed.repository';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import { LocalAdminModerationService } from './admin-moderation.service';
import { LocalRouteDelayService } from './route-delay.service';
@Injectable({ providedIn: 'root' })
export class LocalContentModerationService extends LocalRouteDelayService {
  private readonly repository = inject(LocalContentModerationRepository);
  private readonly assets = inject(LocalAssetsService);
  private readonly events = inject(LocalEventsService);
  private readonly feed = inject(LocalPhotoFeedRepository);
  private readonly support = inject(LocalAdminModerationService);
  private async prepare() { await this.repository.whenReady(); await this.deliverMessages(); await this.waitForRouteDelay('/admin/content-moderation'); }
  async snapshot(_adminUserId: string) { await this.prepare(); return this.repository.snapshot(); }
  async page(_adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery) {
    await this.prepare(); return this.repository.page(category, status, query);
  }
  async settings(_adminUserId: string, revision: number, settings: ContentModerationSettings) {
    await this.prepare();
    if (!Number.isInteger(settings.delayMinutes) || settings.delayMinutes < 0 || settings.delayMinutes > 43200) throw new Error('moderation.invalidSettings');
    return this.repository.saveSettings(settings, revision);
  }
  async decide(id: string, request: ContentModerationDecision, admin?: AdminUserDto) {
    await this.prepare();
    await this.repository.decide(id, request, admin);
    await this.deliverMessages();
    return { snapshot: this.repository.snapshot(), item: this.repository.item(id)! };
  }
  private async deliverMessages() {
    for (const pending of this.repository.state().pendingMessages ?? []) {
      await this.support.sendSupportMessage(pending.ownerUserId, pending.admin, pending.message, 'warned', `content-moderation:${pending.commandId}`);
      await this.repository.acknowledgeMessage(pending.commandId);
    }
  }
  async detail<T>(_adminUserId: string, id: string): Promise<T> {
    await this.prepare(); const item = this.repository.item(id);
    if (!item) throw new Error('moderation.changed');
    let detail: unknown;
    if (item.category === 'asset') detail = await this.assets.loadOwnedAssetDetailById(item.ownerUserId, item.sourceId);
    else if (item.category === 'event') detail = await this.events.loadEventDetailById(item.ownerUserId, item.sourceId);
    else { const record = this.feed.find(item.sourceId); detail = record ? LocalPhotoFeedMapper.toDto(record, record.locationCoordinates) : null; }
    if (!detail) throw new Error('moderation.changed'); return detail as T;
  }
}
