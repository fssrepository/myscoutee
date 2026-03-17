import type { DemoActivityMembersMemorySchema } from './activity-members.model';
import type { DemoChatsMemorySchema } from './chats.model';
import type { DemoEventsMemorySchema } from './events.model';
import type { DemoUsersMemorySchema } from './users.model';

export type DemoMemorySchema = DemoUsersMemorySchema
  & DemoActivityMembersMemorySchema
  & DemoChatsMemorySchema
  & DemoEventsMemorySchema;
