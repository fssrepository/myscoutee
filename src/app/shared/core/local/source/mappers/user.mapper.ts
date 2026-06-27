import { AppUtils } from '../../../../app-utils';
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
    const record = UserRecordsBuilder.cloneUser(dto) as UserRecord;
    record.images = this.normalizeImages(record.images);
    record.affinity = this.resolveUserAffinity(record);
    return record;
  }

  static toRecordList(dtos: readonly UserDto[]): UserRecord[] {
    return dtos.map(dto => this.toRecord(dto));
  }

  static cloneRecord(record: UserRecord): UserRecord {
    return this.toRecord(this.toDto(record));
  }

  private static normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

  private static resolveUserAffinity(user: UserRecord): number {
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

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
      if (normalized) {
        seen.add(normalized);
      }
    }
    return [...seen];
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return tokens.reduce((total, token) => total + ((AppUtils.hashText(`${seedPrefix}:${token}`) % 997) + 1), 0);
  }

  private static parseHeightCm(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }
}

export const localUsersMapper =
  LocalUsersMapper satisfies DtoRecordMapper<UserRecord, UserDto>;
