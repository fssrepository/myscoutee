import { ActivityEventDtoMapper } from '../../../base/mappers/activity-event.mapper';
import { ActivityEventDTO } from '../../../contracts/activity.interface';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventRecord,
  ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';

export class LocalActivityEventsMapper {
  static toDTO(record: ActivityEventRecord): ActivityEventDTO {
    return ActivityEventDtoMapper.toDTO(record);
  }

  static toDTOList(records: readonly ActivityEventRecord[]): ActivityEventDTO[] {
    return ActivityEventDtoMapper.toDTOList(records);
  }

  static toDTOPage(page: ActivityEventActivitiesListQueryResult): ActivityEventPageResultDTO {
    return {
      items: page.records.map(item => ActivityEventDTO.from(item)),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

}
