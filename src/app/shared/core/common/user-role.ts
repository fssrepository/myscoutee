import type { UserDto } from '../contracts/accounts/user.interface';

export function hasOperatorRole(user: UserDto | null | undefined): boolean {
  return user?.operator === true;
}
