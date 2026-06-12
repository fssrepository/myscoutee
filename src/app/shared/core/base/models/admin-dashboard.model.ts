import type { UserDto } from '../interfaces/user.interface';
import type { AdminFeedbackDto, AdminReportedUserDto } from './admin-moderation.model';
import type { AdminUserDto } from './admin-profile.model';

export interface AdminDashboardDto {
  activeAdmin: AdminUserDto;
  activeAdminProfile?: UserDto | null;
  reportedUsers: AdminReportedUserDto[];
  blockedUsers: AdminReportedUserDto[];
  feedback: AdminFeedbackDto[];
}
