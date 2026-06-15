import { UserRecordsBuilder } from '../../../base/builders';
import type { UserDto } from '../../../contracts/user.interface';
import type { UserRecord } from '../entity/user.entity';

export class LocalUsersMapper {
  static toDTO(record: UserRecord): UserDto {
    return UserRecordsBuilder.cloneUser(record as UserDto);
  }

  static toRecord(dto: UserDto): UserRecord {
    return UserRecordsBuilder.cloneUser(dto) as UserRecord;
  }

  static cloneRecord(record: UserRecord): UserRecord {
    return this.toRecord(this.toDTO(record));
  }
}
