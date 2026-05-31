import type { AdminFeedbackDto, AdminReportedUserDto } from './admin-moderation.model';
import type { AdminUserDto } from './admin-profile.model';

export interface AdminDashboardDto {
  activeAdmin: AdminUserDto;
  reportedUsers: AdminReportedUserDto[];
  blockedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}
