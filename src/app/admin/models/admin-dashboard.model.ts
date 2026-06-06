import type { AdminFeedbackDto, AdminReportedUserDto } from './admin-moderation.model';
import type { AdminUserDto } from './admin-profile.model';
import type { UserDto } from '../../shared/core';

export interface AdminDashboardDto {
  activeAdmin: AdminUserDto;
  activeAdminProfile?: UserDto | null;
  reportedUsers: AdminReportedUserDto[];
  blockedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}
