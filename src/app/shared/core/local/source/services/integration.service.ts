import { LocalEventsService } from './events.service';
import { LocalCommunityGroupsService } from './community-groups.service';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { partitionEventInvitesByCapacity } from '../../../base/services/activity-invite-capacity.policy';
import type { ActivityMemberDTO } from '../../../contracts/activity.interface';
import { Injectable, inject } from '@angular/core';

import { UserProfileStore } from '../../../../ui/context/stores/user-profile.store';
import { SessionService } from '../../../base/services/session.service';
import type {
  IntegrationSettingsDto,
  IntegrationTokenCreatedDto
} from '../../../contracts/integration.interface';
import { LocalIntegrationRepository } from '../repositories/integration.repository';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalPaymentSummaryMapper } from '../mappers/payment-summary.mapper';

const INTEGRATIONS_ROUTE = '/integrations';

@Injectable({ providedIn: 'root' })
export class LocalIntegrationService extends LocalRouteDelayService {
  private readonly eventActions = inject(LocalEventsService);
  private readonly groups = inject(LocalCommunityGroupsService);
  private readonly members = inject(LocalActivityMembersService);
  private readonly events = inject(LocalEventsRepository);
  private readonly users = inject(LocalUsersRepository);
  private readonly repository = inject(LocalIntegrationRepository);
  private readonly operatorRepository = inject(LocalOperatorRegistryRepository);
  private readonly session = inject(SessionService);
  private readonly profile = inject(UserProfileStore);

  async externalInviteLink(request: import('../../../contracts/integration.interface').ExternalInviteLinkRequest): Promise<{url: string}> {
    await this.repository.whenReady();
    await this.waitForRouteDelay('/integrations');
    const user = this.users.queryUserById(request.userId);
    if (!user || request.ownerType === 'asset') throw new Error('Invalid invite target');
    const actor = request.ownerType === 'community' ? user.accountUserId ?? user.id : user.id;
    if (request.ownerType === 'community') {
      const group = await this.groups.detail(actor, request.entityId);
      if (group.role !== 'Admin' || group.membershipStatus !== 'accepted') throw new Error('Forbidden');
    } else this.requireEventInvite(actor, request.entityId);
    const result = this.repository.externalInvite(actor, request.ownerType, request.entityId);
    await this.repository.flushToIndexedDb();
    return result;
  }

  async claimExternalInvite(userId: string, token: string) {
    await this.repository.whenReady();
    const invite = this.repository.findExternalInvite(token);
    if (!invite) return null;
    await this.waitForRouteDelay('/integrations');
    const user = this.users.queryUserById(userId);
    if (!user) throw new Error('User unavailable');
    if (invite.ownerType === 'community') {
      const actor = user.accountUserId ?? user.id;
      await this.groups.invite(invite.ownerUserId, invite.entityId, [actor]);
      const group = await this.groups.detail(actor, invite.entityId);
      if (group.membershipStatus !== 'accepted') {
        await this.groups.action(group.requestKind === 'invite' ? actor : invite.ownerUserId, invite.entityId, actor, 'accept');
      }
      await this.users.selectWorkspace(actor, invite.entityId);
      await this.repository.flushToIndexedDb();
      return {groupId: invite.entityId, invitationAvailable: true};
    }
    const event = this.requireEventInvite(invite.ownerUserId, invite.entityId);
    const ownerProfile = this.users.queryUserById(invite.ownerUserId);
    if ((ownerProfile?.workspaceGroupId ?? null) !== (user.workspaceGroupId ?? null)) throw new Error('Forbidden');
    if (Date.parse(event.endAtIso) <= Date.now() || event.cancelled) return {eventId: event.id, invitationAvailable: false};
    const owner = {ownerType: 'event' as const, ownerId: event.id};
    const current = this.members.peekMembersByOwner(owner);
    const inviterCanInvite = event.adminIds?.includes(invite.ownerUserId) || event.creatorUserId === invite.ownerUserId
      || event.acceptedMemberUserIds?.includes(invite.ownerUserId);
    if (!inviterCanInvite) {
      if (!this.events.queryExploreItems(user.id, true).some(item => item.id === event.id)) throw new Error('Forbidden');
      const result = await this.eventActions.requestJoin(user.id, event.id);
      if (!result || result.membershipStatus === 'unchanged') throw new Error('Event participation is unavailable');
      return {eventId: event.id, invitationAvailable: true};
    }
    if (!current.some(member => member.userId === userId && ['accepted', 'pending'].includes(member.status))) {
      const now = new Date().toISOString();
      const candidate: ActivityMemberDTO = {id: `event:${event.id}:${user.id}`, userId: user.id, name: user.name,
        initials: user.initials, gender: user.gender, city: user.city, statusText: user.statusText, role: 'Member',
        status: 'pending', pendingSource: 'admin', requestKind: 'invite', invitedByActiveUser: false,
        invitedByUserId: invite.ownerUserId, metAtIso: now, actionAtIso: now, metWhere: event.location, avatarUrl: user.images?.[0] ?? ''};
      const partition = partitionEventInvitesByCapacity(current, [candidate], event.capacityTotal);
      if (!partition.acceptedAdditions.length) throw new Error('Event invitation could not be created');
      await this.members.replaceMembersByOwner(owner, [...current, candidate], event.capacityTotal, invite.ownerUserId);
    }
    await this.repository.flushToIndexedDb();
    return {eventId: event.id, invitationAvailable: true};
  }

  private requireEventInvite(actor: string, entityId: string) {
    const event = this.events.queryEventRecordById(actor, entityId);
    if (!event || !(event.adminIds?.includes(actor) || event.creatorUserId === actor || event.acceptedMemberUserIds?.includes(actor) || this.events.queryExploreItems(actor, true).some(item => item.id === entityId))) throw new Error('Forbidden');
    return event;
  }

  async loadSettings(admin = false): Promise<IntegrationSettingsDto> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/settings`);
    const settings = this.repository.settings(this.requireUserId(admin), admin ? '/api/admin-client/v1' : await this.publicBaseUrl(), admin);
    if (settings.affiliate?.revenue) {
      const revenue = settings.affiliate.revenue;
      revenue.euroSummary = LocalPaymentSummaryMapper.build(this.requireUserId(admin),
        Object.entries(revenue.currencies).map(([currency, row]) => ({ currency, gross: row.gross, refunded: row.refunded })));
    }
    await this.repository.flushToIndexedDb();
    return settings;
  }

  async createToken(
    name: string,
    expiresInDays: number, admin = false
  ): Promise<IntegrationTokenCreatedDto> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/tokens`);
    const created = this.repository.createToken(
      this.requireUserId(admin),
      name,
      expiresInDays, admin
    );
    await this.repository.flushToIndexedDb();
    return created;
  }

  async revokeToken(tokenId: string, admin = false): Promise<void> {
    await this.repository.whenReady();
    await this.waitForRouteDelay(`${INTEGRATIONS_ROUTE}/tokens`);
    this.repository.revokeToken(this.requireUserId(admin), tokenId, admin);
    await this.repository.flushToIndexedDb();
  }

  private requireUserId(admin = false): string {
    const userId = (admin ? this.session.activeUserId() : this.profile.activeUserId()).trim();
    if (!userId) {
      throw new Error('integration.user.missing');
    }
    return userId;
  }

  private async publicBaseUrl(): Promise<string> {
    const configured = (await this.operatorRepository.read())
      ?.configuration.integration?.publicBaseUrl?.trim();
    const fallback = '/api/integrations/v1';
    try {
      return new URL(
        configured || fallback,
        globalThis.location?.origin ?? 'http://localhost'
      ).toString().replace(/\/$/, '');
    } catch {
      return fallback;
    }
  }
}
