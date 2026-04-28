import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../../../core/base/models';
import type { EventMenuItem, HostingMenuItem, InvitationMenuItem } from '../interfaces/activity-feed.interface';

export class ActivityEventBuilder {
  static buildInvitationPreviewEventSource(invitation: InvitationMenuItem): EventMenuItem {
    return {
      id: `inv-preview-${invitation.id}`,
      avatar: AppUtils.initialsFromText(invitation.inviter),
      title: invitation.description,
      shortDescription: `Invited by ${invitation.inviter}`,
      timeframe: invitation.when,
      activity: Math.max(0, invitation.unread),
      isAdmin: false,
      startAt: invitation.startAt,
      endAt: invitation.endAt,
      distanceKm: invitation.distanceKm,
      acceptedMembers: invitation.acceptedMembers,
      pendingMembers: invitation.pendingMembers,
      capacityTotal: invitation.capacityTotal,
      capacityMin: invitation.capacityMin ?? null,
      capacityMax: invitation.capacityMax ?? null,
      acceptedMemberUserIds: [...(invitation.acceptedMemberUserIds ?? [])],
      pendingMemberUserIds: [...(invitation.pendingMemberUserIds ?? [])],
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
      eventItems: readonly EventMenuItem[];
      hostingItems: readonly HostingMenuItem[];
      invitationItems?: readonly InvitationMenuItem[];
    }
  ): EventMenuItem | HostingMenuItem | null {
    if (row.type === 'invitations') {
      const invitationSource = row.source as InvitationMenuItem;
      const invitation = options.invitationItems?.find(item => item.id === invitationSource.id) ?? invitationSource;
      return this.resolveRelatedEventFromInvitation(invitation, options) ?? this.buildInvitationPreviewEventSource(invitation);
    }
    if (row.type !== 'events' && row.type !== 'hosting') {
      return null;
    }
    const rowSource = row.source as EventMenuItem | HostingMenuItem;
    const rowSourceId = typeof rowSource?.id === 'string' ? rowSource.id.trim() : '';
    let source = rowSourceId
      ? (options.eventItems.find(item => item.id === rowSourceId)
        ?? options.hostingItems.find(item => item.id === rowSourceId)
        ?? null)
      : null;
    if (!source && typeof rowSource?.title === 'string' && rowSource.title.trim()) {
      const titleKey = AppUtils.normalizeText(rowSource.title);
      source = options.eventItems.find(item => AppUtils.normalizeText(item.title) === titleKey)
        ?? options.hostingItems.find(item => AppUtils.normalizeText(item.title) === titleKey)
        ?? null;
    }
    return source ?? rowSource;
  }

  private static resolveRelatedEventFromInvitation(
    invitation: InvitationMenuItem,
    options: {
      eventItems: readonly EventMenuItem[];
      hostingItems: readonly HostingMenuItem[];
    }
  ): EventMenuItem | HostingMenuItem | null {
    const invitationId = invitation.id.trim();
    if (invitationId) {
      const relatedById = options.eventItems.find(item => item.id === invitationId)
        ?? options.hostingItems.find(item => item.id === invitationId);
      if (relatedById) {
        return relatedById;
      }
    }
    const invitationTitle = AppUtils.normalizeText(invitation.description);
    const relatedEvent = options.eventItems.find(item => AppUtils.normalizeText(item.title) === invitationTitle);
    if (relatedEvent) {
      return relatedEvent;
    }
    const relatedHosting = options.hostingItems.find(item => AppUtils.normalizeText(item.title) === invitationTitle);
    if (relatedHosting) {
      return relatedHosting;
    }
    return null;
  }
}
