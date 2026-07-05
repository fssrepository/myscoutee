import type {
  ContextualDtoToRecordMapper,
  DtoRecordMapper,
  NullableRecordToDtoMapper
} from './mapper.types';
import { BaseUserRatesMapper, type UserRateRecordDTO } from '../../../base/mappers';
import type { ActivityRateDTO, UserGameFilterPreferencesDto } from '../../../contracts/activity.interface';
import type { UserFilterPreferencesRecord, UserRateRecord } from '../entity/rate.entity';

export class LocalUserRatesMapper {
  static toRecord(ownerUserId: string, item: ActivityRateDTO): UserRateRecord;
  static toRecord(input: UserRateRecordDTO): UserRateRecord | null;
  static toRecord(ownerUserIdOrInput: string | UserRateRecordDTO, item?: ActivityRateDTO): UserRateRecord | null {
    return typeof ownerUserIdOrInput === 'string'
      ? BaseUserRatesMapper.toRecord(ownerUserIdOrInput, item!)
      : BaseUserRatesMapper.toRecord(ownerUserIdOrInput);
  }

  static toDto(record: UserRateRecord): ActivityRateDTO | null {
    return BaseUserRatesMapper.toDto(record);
  }
}

export const localUserRatesMapper =
  LocalUserRatesMapper satisfies ContextualDtoToRecordMapper<string, ActivityRateDTO, UserRateRecord>
    & NullableRecordToDtoMapper<UserRateRecord, ActivityRateDTO>;

export class LocalUserFilterPreferencesMapper {
  static toDto(record: UserFilterPreferencesRecord): UserGameFilterPreferencesDto {
    return this.clone(record);
  }

  static toDtoList(records: readonly UserFilterPreferencesRecord[]): UserGameFilterPreferencesDto[] {
    return records.map(record => this.toDto(record));
  }

  static toRecord(dto: UserGameFilterPreferencesDto): UserFilterPreferencesRecord {
    return this.clone(dto);
  }

  static toRecordList(dtos: readonly UserGameFilterPreferencesDto[]): UserFilterPreferencesRecord[] {
    return dtos.map(dto => this.toRecord(dto));
  }

  private static clone(
    preferences: UserFilterPreferencesRecord | UserGameFilterPreferencesDto
  ): UserFilterPreferencesRecord {
    return {
      ...preferences,
      interests: [...(preferences.interests ?? [])],
      values: [...(preferences.values ?? [])],
      physiques: [...(preferences.physiques ?? [])],
      languages: [...(preferences.languages ?? [])],
      genders: [...(preferences.genders ?? [])],
      horoscopes: [...(preferences.horoscopes ?? [])],
      traitLabels: [...(preferences.traitLabels ?? [])],
      smoking: [...(preferences.smoking ?? [])],
      drinking: [...(preferences.drinking ?? [])],
      workout: [...(preferences.workout ?? [])],
      pets: [...(preferences.pets ?? [])],
      familyPlans: [...(preferences.familyPlans ?? [])],
      children: [...(preferences.children ?? [])],
      loveStyles: [...(preferences.loveStyles ?? [])],
      communicationStyles: [...(preferences.communicationStyles ?? [])],
      sexualOrientations: [...(preferences.sexualOrientations ?? [])],
      religions: [...(preferences.religions ?? [])]
    };
  }
}

export const localUserFilterPreferencesMapper =
  LocalUserFilterPreferencesMapper satisfies DtoRecordMapper<
    UserFilterPreferencesRecord,
    UserGameFilterPreferencesDto
  >;
