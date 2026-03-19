import { EventMenuItem } from '../shared/demo-data';
import { UserDto } from '../shared/core';

export interface EventFeedbackPopupHost {
  eventItems: EventMenuItem[];
  users: UserDto[];
  activeUser: UserDto;
  eventDatesById: Record<string, string>;
  activityImageById: Record<string, string>;
  eventStartAtMs(eventId: string): number | null;
  eventTitleById(eventId: string): string;
}
