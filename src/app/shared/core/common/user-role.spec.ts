import type { UserDto } from '../contracts/user.interface';
import { hasOperatorRole } from './user-role';

describe('hasOperatorRole', () => {
  it('requires the explicit operator flag', () => {
    expect(hasOperatorRole({ operator: true } as UserDto)).toBe(true);
    expect(hasOperatorRole({ operator: false, hostTier: 'Operator' } as UserDto)).toBe(false);
    expect(hasOperatorRole({ hostTier: 'Operator' } as UserDto)).toBe(false);
    expect(hasOperatorRole(null)).toBe(false);
  });
});
