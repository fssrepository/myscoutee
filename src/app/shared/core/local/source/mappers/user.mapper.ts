import { UserRecordsBuilder } from '../../../base/builders';
import type { DtoRecordMapper } from '../../../base/mappers/mapper.types';
import type { UserDto } from '../../../contracts/user.interface';
import type { UserRecord } from '../entity/user.entity';

export class LocalUsersMapper {
  static toDto(record: UserRecord): UserDto {
    return UserRecordsBuilder.cloneUser(record as UserDto);
  }

  static toDtoList(records: readonly UserRecord[]): UserDto[] {
    return records.map(record => this.toDto(record));
  }

  static toRecord(dto: UserDto): UserRecord {
    return UserRecordsBuilder.cloneUser(dto) as UserRecord;
  }

  static toRecordList(dtos: readonly UserDto[]): UserRecord[] {
    return dtos.map(dto => this.toRecord(dto));
  }

  static cloneRecord(record: UserRecord): UserRecord {
    return this.toRecord(this.toDto(record));
  }
}

export const localUsersMapper =
  LocalUsersMapper satisfies DtoRecordMapper<UserRecord, UserDto>;
