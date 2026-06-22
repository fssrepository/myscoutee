import { ActivityEventDtoMapper } from '../../../base/mappers/activity-event.mapper';
import { ActivityEventDTO } from '../../../contracts/activity.interface';
import type {
  ActivityEventActivitiesListQueryResult,
  ActivityEventListItem,
  ActivityEventRecord,
  ActivityEventPageResultDTO
} from '../../../contracts/activity.interface';

export class LocalActivityEventsMapper {
  static toDTO(record: ActivityEventRecord | ActivityEventListItem): ActivityEventDTO {
    return ActivityEventDtoMapper.toDTO(record);
  }

  static toDTOList(records: readonly (ActivityEventRecord | ActivityEventListItem)[]): ActivityEventDTO[] {
    return ActivityEventDtoMapper.toDTOList(records);
  }

  static toDTOPage(page: ActivityEventActivitiesListQueryResult): ActivityEventPageResultDTO {
    return {
      items: this.toDTOList(page.records),
      total: page.total,
      nextCursor: page.nextCursor
    };
  }

}
