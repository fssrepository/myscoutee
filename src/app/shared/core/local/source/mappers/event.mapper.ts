import { ActivityEventDtoMapper } from '../../../base/mappers/activity-event.mapper';
import type { DtoListMapper } from '../../../base/mappers/mapper.types';
import { ActivityEventDTO } from '../../../contracts/activity.interface';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventRecord,
  ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';

export class LocalActivityEventsMapper {
  static toDto(record: ActivityEventRecord): ActivityEventDTO {
    return ActivityEventDtoMapper.toDto(record);
  }

  static toDtoList(records: readonly ActivityEventRecord[]): ActivityEventDTO[] {
    return ActivityEventDtoMapper.toDtoList(records);
  }

  static toDtoPage(page: ActivityEventActivitiesListQueryResult): ActivityEventPageResultDTO {
    return {
      items: page.records.map(item => ActivityEventDTO.from(item)),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

}

export const localActivityEventsMapper =
  LocalActivityEventsMapper satisfies DtoListMapper<ActivityEventRecord, ActivityEventDTO>;
