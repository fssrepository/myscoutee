import type { ActivityPendingReason } from '../../../common/constants';
import type {
  ActivityEventRecord,
  EventParticipationActionResultDTO
} from '../../../contracts/activity.interface';

export class LocalEventParticipationActionMapper {
  static toResult(
    record: ActivityEventRecord,
    userId: string,
    options: {
      slotSourceId?: string | null;
      paymentSessionId?: string | null;
      pendingReason?: ActivityPendingReason;
    } = {}
  ): EventParticipationActionResultDTO {
    const acceptedMembers = this.nonNegativeInteger(record.acceptedMembers);
    const pendingMembers = this.nonNegativeInteger(record.pendingMembers);
    const capacityTotal = Math.max(acceptedMembers, this.nonNegativeInteger(record.capacityTotal));
    const pendingReason = this.normalizePendingReason(options.pendingReason ?? record.pendingReason);
    const normalizedUserId = userId.trim();

    return {
      sourceId: record.id,
      slotSourceId: options.slotSourceId?.trim() || null,
      action: 'join',
      membershipStatus: pendingReason || !record.acceptedMemberUserIds?.includes(normalizedUserId)
        ? 'pending'
        : 'accepted',
      pendingReason,
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      full: capacityTotal > 0 && acceptedMembers >= capacityTotal,
      paymentSessionId: options.paymentSessionId?.trim() || null
    };
  }

  private static normalizePendingReason(value: ActivityPendingReason | undefined): ActivityPendingReason {
    if (value === 'waitlist') {
      return 'waitlist';
    }
    if (value === 'approval') {
      return 'approval';
    }
    return null;
  }

  private static nonNegativeInteger(value: unknown): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }
}
