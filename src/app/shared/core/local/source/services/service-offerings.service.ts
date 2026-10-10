import { Injectable, inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalServiceOfferingsRepository } from '../repositories/service-offerings.repository';
import { LocalCommunityAccessService } from './community-access.service';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalCampaignMapper } from '../mappers/campaign.mapper';
import { UserProfileState } from '../../../common/user-profile-state';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
import { SERVICE_CATEGORIES, SERVICE_FREQUENCIES, type IServiceOfferingsService, type ServiceOffering, type ServiceOfferingItem, type SaveServiceOffering, type ServiceAction, type ServiceOfferingFilters } from '../../../contracts/service-offering.interface';
import type { ListQuery } from '@myscoutee/components';
@Injectable({ providedIn: 'root' })
export class LocalServiceOfferingsService extends LocalRouteDelayService implements IServiceOfferingsService {
  private readonly services = inject(LocalServiceOfferingsRepository);
  private readonly access = inject(LocalCommunityAccessService);
  private readonly users = inject(LocalUsersRepository);
  private profileId(account: string) { return `group:${COMMUNITY_BASE_GROUP_ID}:${account}`; }
  private async actor(userId: string, signal?: AbortSignal) {  await this.services.ready(); signal?.throwIfAborted(); return this.access.actor(userId); }
  private visible(actor: string, id: string) {
    const s = this.services.find(id);
    if (!s || s.baseGroupId !== COMMUNITY_BASE_GROUP_ID || s.ownerAccountId !== actor && s.status !== 'published') throw new Error('Service unavailable'); return s;
  }
  private dto(actor: string, s: ServiceOffering, ratings: Map<string,number>): ServiceOfferingItem {
    const viewer = this.users.queryUserById(this.profileId(actor)), owner = this.users.queryUserById(this.profileId(s.ownerAccountId));
    if (!viewer || !owner || actor !== s.ownerAccountId && !UserProfileState.isActivityRateVisibleProfile(owner)) throw new Error('Service unavailable');
    return { service: structuredClone(s), ownerUserId: owner.id, ownerName: owner.name, ownerAvatarUrl: owner.images?.[0] ?? null,
      distanceKm: LocalCampaignMapper.distance(owner, viewer), viewerRating: ratings.get(owner.id) ?? 0, canManage: s.ownerAccountId === actor };
  }
  async detail(userId: string, id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/service-offerings', signal),
      (async () => {
        const actor = await this.actor(userId, signal); return this.dto(actor, this.visible(actor,id), this.services.ratingsByProvider(this.profileId(actor)));
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async page(userId: string, query: ListQuery<ServiceOfferingFilters>, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/service-offerings', signal),
      (async () => {
        const actor = await this.actor(userId, signal), f = query.filters ?? {}, scope = f.scope ?? 'own', own = scope === 'own', status = f.status ?? 'published';
            if (!['own','discover','all'].includes(scope) || !['draft','published','trash'].includes(status) || f.maxDistanceKm != null && (!Number.isFinite(f.maxDistanceKm) || f.maxDistanceKm < 1 || f.maxDistanceKm > 20000)) throw new Error('Invalid filters');
            if (f.serviceIds && (!Array.isArray(f.serviceIds) || f.serviceIds.length > 100)) throw new Error('Invalid service selection');
            const ids=f.serviceIds?new Set(f.serviceIds):null;
            const ratings = this.services.ratingsByProvider(this.profileId(actor)), needle = f.search?.trim().toLowerCase() ?? '';
            const viewer = this.users.queryUserById(this.profileId(actor))!;
            const rows = this.services.records().filter(s => s.baseGroupId === COMMUNITY_BASE_GROUP_ID && s.status === (own ? status : 'published') && (!ids || ids.has(s.id)) && (!own || s.ownerAccountId === actor)
              && (scope !== 'discover' || s.ownerAccountId !== actor) && (!f.category || s.category === f.category) && (!needle || `${s.title}\n${s.description}`.toLowerCase().includes(needle)))
              .filter(s => { const owner = this.users.queryUserById(this.profileId(s.ownerAccountId)); return !!owner && (s.ownerAccountId === actor || UserProfileState.isActivityRateVisibleProfile(owner)); })
              .map(s => this.dto(actor,s,ratings)).filter(i => f.maxDistanceKm == null || i.distanceKm != null && i.distanceKm <= f.maxDistanceKm)
              .filter(i => scope !== 'discover' || (i.service.maxDistanceKm == null || i.distanceKm != null && i.distanceKm <= i.service.maxDistanceKm) && (!i.service.languages.length || i.service.languages.some(l => viewer.languages.includes(l))))
              .sort((a,b) => (own ? b.service.updatedAtIso.localeCompare(a.service.updatedAtIso) : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)) || a.service.id.localeCompare(b.service.id));
            const page = Number(query.cursor ?? 0), size = Math.max(1,Math.min(50,query.pageSize));
            if (!Number.isSafeInteger(page) || page < 0 || page > 1000000) throw new Error('Invalid cursor');
            const start = page * size, end = start + size; return { items: rows.slice(start,end), total: rows.length, nextCursor: end < rows.length ? `${page+1}` : null };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async save(r: SaveServiceOffering) {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/service-offerings'),
      (async () => {
        const actor = await this.actor(r.userId);
            if (!r.title?.trim() || r.title.trim().length > 120 || r.description == null || r.description.length > 120 || !SERVICE_CATEGORIES.includes(r.category) || r.imageUrls.length > 4
              || r.languages.length > 20 || !r.staffAccountIds.length || r.staffAccountIds.length > 100 || r.maxDistanceKm != null && (!Number.isFinite(r.maxDistanceKm) || r.maxDistanceKm < 1 || r.maxDistanceKm > 20000)
              || !SERVICE_FREQUENCIES.includes(r.frequency as typeof SERVICE_FREQUENCIES[number]) || !Number.isInteger(r.durationMinutes) || r.durationMinutes < 5 || r.durationMinutes > 1440 || r.slotTemplates.length > 366) throw new Error('Invalid service');
            const members = new Set(this.access.roster(COMMUNITY_BASE_GROUP_ID).map(m=>m.userId));
            if(r.staffAccountIds.some(id=>!members.has(id)))throw new Error('Invalid staff');
            if(r.slotsEnabled && (!(Date.parse(r.endAtIso ?? '') > Date.parse(r.startAtIso ?? '')) || !r.slotTemplates.length || r.slotTemplates.some(s=>!s.id || !Number.isFinite(Date.parse(s.startAt ?? '')) || !!s.subEventDefinitions?.length)))throw new Error('Invalid slots');
            if(r.slotsEnabled&&(new Set(r.slotTemplates.map(s=>s.id)).size!==r.slotTemplates.length||r.slotTemplates.some(s=>s.overrideDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(s.overrideDate)||!Number.isFinite(Date.parse(s.overrideDate))||new Date(s.overrideDate).toISOString().slice(0,10)!==s.overrideDate))))throw new Error('Invalid slots');
            const old = r.id ? this.visible(actor,r.id) : null;
            if(old && (old.ownerAccountId !== actor || old.status === 'trash'))throw new Error('Forbidden');
            if(old && old.version !== r.version)throw new Error('service.changed');
            const now = new Date().toISOString();
            const s = this.services.save({id:old?.id ?? crypto.randomUUID(),baseGroupId:COMMUNITY_BASE_GROUP_ID,ownerAccountId:actor,title:r.title.trim(),description:r.description.trim(),sourceLink:r.sourceLink?.trim()??'',category:r.category,imageUrls:[...r.imageUrls],
              maxDistanceKm:r.maxDistanceKm,languages:[...new Set(r.languages)],staffAccountIds:[...new Set(r.staffAccountIds)],slotsEnabled:r.slotsEnabled,startAtIso:r.slotsEnabled?new Date(r.startAtIso!).toISOString():null,endAtIso:r.slotsEnabled?new Date(r.endAtIso!).toISOString():null,
              frequency:r.frequency,durationMinutes:r.durationMinutes,slotTemplates:structuredClone(r.slotTemplates),pricing:structuredClone(r.pricing),status:old?.status??'draft',createdAtIso:old?.createdAtIso??now,updatedAtIso:now,version:(old?.version??-1)+1},old?.version);
            await this.services.flush();return this.dto(actor,s,new Map());
      })()
    ]);
    return response;
  }
  async action(userId:string,id:string,action:ServiceAction,version:number) {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/service-offerings'),
      (async () => {
        const actor=await this.actor(userId),s=this.visible(actor,id);if(s.ownerAccountId!==actor)throw new Error('Forbidden');
            const transitions={publish:['draft','published'],unpublish:['published','draft'],trash:[s.status,'trash'],restore:['trash','draft']} as const;
            const next=transitions[action];if(!next||s.status!==next[0]||action==='trash'&&s.status==='trash')throw new Error('Invalid transition');
            const saved=this.services.save({...s,status:next[1],updatedAtIso:new Date().toISOString(),version:version+1},version);
            await this.services.flush();return this.dto(actor,saved,new Map());
      })()
    ]);
    return response;
  }
}
