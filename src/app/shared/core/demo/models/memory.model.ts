import type { DemoChatsMemorySchema } from './chats.model';
import type { DemoEventsMemorySchema } from './events.model';
import type { DemoRatesMemorySchema } from './rates.model';
import type { DemoUsersMemorySchema } from './users.model';

export type DemoMemorySchema = DemoUsersMemorySchema
  & DemoChatsMemorySchema
  & DemoEventsMemorySchema
  & DemoRatesMemorySchema;
