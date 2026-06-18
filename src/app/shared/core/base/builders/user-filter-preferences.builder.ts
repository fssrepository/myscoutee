import type { UserGameFilterPreferencesDto } from '../../contracts/activity.interface';
import type { UserDto } from '../../contracts/user.interface';

export class UserFilterPreferencesBuilder {
  static buildDefaultFilterPreferences(_user: UserDto): UserGameFilterPreferencesDto {
    return {
      ageMin: 18,
      ageMax: 120,
      heightMinCm: 40,
      heightMaxCm: 250,
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
}
