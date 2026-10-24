import { UserAffinityBuilder } from '../../../../base/builders/accounts/user-affinity.builder';
import { AppUtils } from '../../../../base/app-utils';
import type { DtoRecordMapper } from '../common/mapper.types';
import type { UserDto, UserSelectorListItemDto } from '../../../../contracts/accounts/user.interface';
import type { UserRecord } from '../../entity/accounts/user.entity';

export class LocalUsersMapper {
  static toDto(record: UserRecord): UserDto {
    const { integrationAccess: _integrationAccess, activeWorkspaceGroupId: _activeWorkspace, devices: _devices, affiliateCode: _code, affiliateRegistrations: _registrations, affiliateReferrerUserId: _referrer, affiliateRevenue: _revenue, affiliatePayments: _payments, savedPaymentMethods:_savedPaymentMethods, externalInvites: _invites, ...profile } = record;
    return this.cloneUser({ ...profile, notificationDevices: (_devices ?? []).map(device => ({
      deviceId: device.deviceId, notificationsEnabled: device.notificationsEnabled === true
    })) });
  }

  static toDtoList(records: readonly UserRecord[]): UserDto[] {
    return records.map(record => this.toDto(record));
  }

  static toSelectorListItem(record: UserRecord): UserSelectorListItemDto {
    return {
      id: record.id,
      locationRequired: !record.partitionKey?.trim(),
      locationCoordinates: record.locationCoordinates ? { ...record.locationCoordinates } : null,
      name: record.name,
      city: record.city,
      initials: record.initials,
      avatarUrl: (record.images ?? [])
        .find(imageUrl => `${imageUrl ?? ''}`.trim())
        ?.replace(/\/large\.webp$/, '/small.webp') ?? '',
      gender: record.gender,
      statusText: record.statusText,
      completion: record.completion,
      profileFormVersion: record.profileFormVersion,
      status: record.status,
      deletedAtIso: record.deletedAtIso ?? null
    };
  }

  static toSelectorListItemList(records: readonly UserRecord[]): UserSelectorListItemDto[] {
    return records.map(record => this.toSelectorListItem(record));
  }

  static toRecord(dto: UserDto): UserRecord {
    const { notificationDevices: _notificationDevices, ...profile } = this.cloneUser(dto);
    const record = profile as UserRecord;
    record.images = this.normalizeImages(record.images);
    record.affinity = this.resolveUserAffinity(record);
    return record;
  }

  static toRecordList(dtos: readonly UserDto[]): UserRecord[] {
    return dtos.map(dto => this.toRecord(dto));
  }

  static cloneRecord(record: UserRecord): UserRecord {
    return { ...this.toRecord(this.toDto(record)), activeWorkspaceGroupId: record.activeWorkspaceGroupId, affiliateCode: record.affiliateCode,
      integrationAccess: record.integrationAccess ? structuredClone(record.integrationAccess) : undefined,
      externalInvites: record.externalInvites?.map(invite => ({...invite})),
      affiliateReferrerUserId: record.affiliateReferrerUserId,
      affiliateRevenue: record.affiliateRevenue ? structuredClone(record.affiliateRevenue) : undefined,
      savedPaymentMethods:record.savedPaymentMethods?structuredClone(record.savedPaymentMethods):undefined,
      affiliatePayments: record.affiliatePayments ? structuredClone(record.affiliatePayments) : undefined,
      affiliateRegistrations: record.affiliateRegistrations?.map(item => ({ ...item })) };
  }

  private static cloneUser(user: UserDto | UserRecord): UserDto {
    return {
      ...user,
      locationCoordinates: user.locationCoordinates
        ? {
          latitude: user.locationCoordinates.latitude,
          longitude: user.locationCoordinates.longitude
        }
        : undefined,
      languages: [...(user.languages ?? [])],
      images: [...(user.images ?? [])],
      profileDetails: user.profileDetails
        ? user.profileDetails.map(group => ({
          title: `${group.title ?? ''}`,
          rows: (group.rows ?? []).map(row => ({
            labelKey: `${row.labelKey ?? ''}`,
            value: `${row.value ?? ''}`,
            privacy: row.privacy,
            options: [...(row.options ?? [])]
          }))
        }))
        : undefined,
      impressions: user.impressions
        ? {
          host: user.impressions.host
            ? {
              ...user.impressions.host,
              vibeBadges: [...(user.impressions.host.vibeBadges ?? [])],
              personalityBadges: [...(user.impressions.host.personalityBadges ?? [])],
              personalityTraits: (user.impressions.host.personalityTraits ?? []).map(trait => ({ ...trait })),
              categoryBadges: [...(user.impressions.host.categoryBadges ?? [])]
            }
            : undefined,
          member: user.impressions.member
            ? {
              ...user.impressions.member,
              vibeBadges: [...(user.impressions.member.vibeBadges ?? [])],
              personalityBadges: [...(user.impressions.member.personalityBadges ?? [])],
              personalityTraits: (user.impressions.member.personalityTraits ?? []).map(trait => ({ ...trait })),
              categoryBadges: [...(user.impressions.member.categoryBadges ?? [])]
            }
            : undefined
        }
        : undefined,
      notificationDevices: 'notificationDevices' in user
        ? user.notificationDevices?.map(device => ({ ...device })) : undefined,
      notificationPreferences: user.notificationPreferences
        ? {
          muted: user.notificationPreferences.muted === true
        }
        : undefined,
      paymentTotals: user.paymentTotals
        ? {
          outgoing: { ...(user.paymentTotals.outgoing ?? {}) },
          incoming: { ...(user.paymentTotals.incoming ?? {}) },
          all: { ...(user.paymentTotals.all ?? {}) }
        }
        : undefined,
      activities: {
        ...user.activities
      }
    };
  }

  private static normalizeImages(images: readonly string[] | undefined): string[] {
    return (images ?? [])
      .map(image => image?.trim() ?? '')
      .filter(image => image.length > 0);
  }

  private static resolveUserAffinity(user: UserRecord): number {
    return UserAffinityBuilder.resolveUserAffinity(user);
  }

  private static uniqueAffinityTokens(values: readonly string[]): string[] {
    return UserAffinityBuilder.uniqueAffinityTokens(values);
  }

  private static resolveAffinityTokenScore(tokens: readonly string[], seedPrefix: string): number {
    return UserAffinityBuilder.resolveAffinityTokenScore(tokens, seedPrefix);
  }

  private static parseHeightCm(value: string): number | null {
    return UserAffinityBuilder.parseHeightCm(value);
  }
}

export const localUsersMapper =
  LocalUsersMapper satisfies DtoRecordMapper<UserRecord, UserDto>;
