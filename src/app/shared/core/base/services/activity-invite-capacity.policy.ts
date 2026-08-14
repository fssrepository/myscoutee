import type {
  ActivityMemberDTO,
  ActivityMemberInviteRejectionDTO
} from '../../contracts/activity.interface';

export interface ActivityInviteCapacityPartition {
  acceptedAdditions: ActivityMemberDTO[];
  rejections: ActivityMemberInviteRejectionDTO[];
}

export function partitionEventInvitesByCapacity(
  currentMembers: readonly ActivityMemberDTO[],
  additions: readonly ActivityMemberDTO[],
  capacityTotal: number
): ActivityInviteCapacityPartition {
  if (!Number.isFinite(capacityTotal) || capacityTotal <= 0) {
    return {
      acceptedAdditions: additions.map(candidate => ({ ...candidate })),
      rejections: []
    };
  }
  const occupiedPlaces = currentMembers.filter(occupiesEventCapacity).length;
  const availablePlaces = Math.max(0, Math.trunc(capacityTotal) - occupiedPlaces);
  return {
    acceptedAdditions: additions.slice(0, availablePlaces).map(candidate => ({ ...candidate })),
    rejections: additions.slice(availablePlaces).map(candidate => ({
      userId: candidate.userId,
      reason: 'capacity-full'
    }))
  };
}

function occupiesEventCapacity(member: ActivityMemberDTO): boolean {
  return member.status === 'accepted'
    || (member.status === 'pending'
      && (member.requestKind === 'invite' || member.pendingSource === 'admin'));
}
