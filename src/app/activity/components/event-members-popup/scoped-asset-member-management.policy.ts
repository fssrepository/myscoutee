import type { ActivityMemberDTO } from '../../../shared/core/contracts/activity.interface';

export function canManageScopedAssetMembers(
  activeUserId: string,
  members: readonly Pick<ActivityMemberDTO, 'userId' | 'status' | 'role'>[]
): boolean {
  const normalizedActiveUserId = activeUserId.trim();
  if (!normalizedActiveUserId) {
    return false;
  }
  return members.some(member => (
    member.userId === normalizedActiveUserId
    && member.status === 'accepted'
    && member.role === 'Manager'
  ));
}
