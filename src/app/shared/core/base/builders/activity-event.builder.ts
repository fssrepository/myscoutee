import { AppUtils } from '../../../app-utils';
import type * as ContractTypes from '../../contracts';

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
  policies?: readonly ContractTypes.EventPolicyDTO[];
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

}
