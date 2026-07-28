import type { UserDto } from '../contracts/user.interface';

export function hasOperatorRole(user: UserDto | null | undefined): boolean {
  return user?.operator === true;
}
