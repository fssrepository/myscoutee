import { AppUtils } from '../../app-utils';
import type { UserDto } from '../../../contracts/accounts/user.interface';

export class UserAffinityBuilder {
  static resolveUserAffinity(
    user: Pick<
      UserDto,
      | 'id'
      | 'name'
      | 'age'
      | 'city'
      | 'height'
      | 'physique'
      | 'languages'
      | 'horoscope'
      | 'gender'
      | 'hostTier'
      | 'traitLabel'
      | 'completion'
    >
  ): number {
    const tokens = this.uniqueAffinityTokens([
      user.name,
      user.city,
      user.physique,
      ...(user.languages ?? []),
      user.horoscope,
      user.gender,
      user.hostTier,
      user.traitLabel
    ]);
    const heightCm = this.parseHeightCm(user.height) ?? 170;
    return (
      this.resolveAffinityTokenScore(tokens, `user:${user.id}`) * 97
      + Math.max(18, Math.trunc(Number(user.age) || 30)) * 17
      + heightCm * 11
      + Math.max(0, Math.trunc(Number(user.completion) || 0)) * 13
    );
  }

  static parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }

  static uniqueAffinityTokens(values: readonly string[]): string[] { return AppUtils.uniqueAffinityTokens(values); }
}
