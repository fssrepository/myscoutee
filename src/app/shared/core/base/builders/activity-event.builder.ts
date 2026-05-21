import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';

type ActivityEventSourceLike = {
  id: string;
  avatar?: string;
  title?: string;
  subtitle?: string;
  shortDescription?: string;
  description?: string;
  inviter?: string | null;
  creatorName?: string | null;
  creatorUserId?: string | null;
  isAdmin?: boolean;
  timeframe?: string;
  when?: string;
  activity?: number;
  unread?: number;
  startAt?: string;
  endAt?: string;
  distanceKm?: number;
  acceptedMembers?: number;
  pendingMembers?: number;
  capacityTotal?: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  imageUrl?: string;
  sourceLink?: string;
  location?: string;
  locationCoordinates?: unknown;
  policies?: readonly AppTypes.EventPolicyItem[];
};

export class ActivityEventBuilder {
  static buildInvitationPreviewEventSource(invitation: ActivityEventSourceLike): ActivityEventSourceLike {
    const inviter = `${invitation.inviter ?? invitation.creatorName ?? invitation.title ?? ''}`.trim();
    const description = `${invitation.description ?? invitation.title ?? ''}`.trim();
    return {
      id: `inv-preview-${invitation.id}`,
      avatar: AppUtils.initialsFromText(inviter),
      title: description,
      shortDescription: `Invited by ${inviter}`,
      timeframe: invitation.when ?? invitation.timeframe ?? '',
      activity: Math.max(0, Number(invitation.unread) || 0),
      isAdmin: false,
      creatorUserId: invitation.creatorUserId,
      creatorName: invitation.creatorName ?? inviter,
      startAt: invitation.startAt,
      endAt: invitation.endAt,
      distanceKm: invitation.distanceKm,
      acceptedMembers: invitation.acceptedMembers,
      pendingMembers: invitation.pendingMembers,
      capacityTotal: invitation.capacityTotal,
      capacityMin: invitation.capacityMin ?? null,
      capacityMax: invitation.capacityMax ?? null,
      imageUrl: invitation.imageUrl,
      sourceLink: invitation.sourceLink,
      location: invitation.location,
      locationCoordinates: invitation.locationCoordinates,
      policies: (invitation.policies ?? []).map(item => ({ ...item }))
    };
  }

  static resolveEditorSource(
    row: AppTypes.ActivityListRow,
    options: {
      eventItems: readonly ActivityEventSourceLike[];
      hostingItems: readonly ActivityEventSourceLike[];
      invitationItems?: readonly ActivityEventSourceLike[];
    }
  ): ActivityEventSourceLike | null {
    if (row.type === 'invitations') {
      const invitation = options.invitationItems?.find(item => item.id === row.id) ?? null;
      if (!invitation) {
        return null;
      }
      return this.resolveRelatedEventFromInvitation(invitation, options) ?? this.buildInvitationPreviewEventSource(invitation);
    }
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    let source = options.eventItems.find(item => item.id === row.id)
      ?? options.hostingItems.find(item => item.id === row.id)
      ?? null;
    if (!source && row.title.trim()) {
      const titleKey = AppUtils.normalizeText(row.title);
      source = options.eventItems.find(item => AppUtils.normalizeText(item.title ?? '') === titleKey)
        ?? options.hostingItems.find(item => AppUtils.normalizeText(item.title ?? '') === titleKey)
        ?? null;
    }
    return source;
  }

  private static resolveRelatedEventFromInvitation(
    invitation: ActivityEventSourceLike,
    options: {
      eventItems: readonly ActivityEventSourceLike[];
      hostingItems: readonly ActivityEventSourceLike[];
    }
  ): ActivityEventSourceLike | null {
    const invitationId = invitation.id.trim();
    if (invitationId) {
      const relatedById = options.eventItems.find(item => item.id === invitationId)
        ?? options.hostingItems.find(item => item.id === invitationId);
      if (relatedById) {
        return relatedById;
      }
    }
    const invitationTitle = AppUtils.normalizeText(`${invitation.description ?? invitation.title ?? ''}`);
    const relatedEvent = options.eventItems.find(item => AppUtils.normalizeText(item.title ?? '') === invitationTitle);
    if (relatedEvent) {
      return relatedEvent;
    }
    const relatedHosting = options.hostingItems.find(item => AppUtils.normalizeText(item.title ?? '') === invitationTitle);
    if (relatedHosting) {
      return relatedHosting;
    }
    return null;
  }
}
