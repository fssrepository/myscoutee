export interface AdminUserDto {
  id: string;
  name: string;
  initials: string;
  email: string;
  headline?: string | null;
  about?: string | null;
  images?: string[] | null;
}
