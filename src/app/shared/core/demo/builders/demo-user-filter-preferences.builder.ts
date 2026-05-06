import type { UserGameFilterPreferencesDto } from '../../base/interfaces/game.interface';
import type { UserDto } from '../../base/interfaces/user.interface';

export class DemoUserFilterPreferencesBuilder {
  static buildDefaultFilterPreferences(user: UserDto): UserGameFilterPreferencesDto {
    const baseAge = Number.isFinite(user.age) && user.age >= 18 ? Math.trunc(Number(user.age)) : 30;
    const parsedHeight = this.parseHeightCm(user.height);
    return {
      ageMin: Math.max(18, baseAge - 5),
      ageMax: Math.min(120, baseAge + 5),
      heightMinCm: Math.max(40, (parsedHeight ?? 170) - 10),
      heightMaxCm: Math.min(250, (parsedHeight ?? 170) + 10),
      interests: [],
      values: [],
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: [],
      smoking: [],
      drinking: [],
      workout: [],
      pets: [],
      familyPlans: [],
      children: [],
      loveStyles: [],
      communicationStyles: [],
      sexualOrientations: [],
      religions: []
    };
  }

  private static parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }
}
