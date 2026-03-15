import type { DemoEventsMemorySchema } from './events.model';
import type { DemoUsersMemorySchema } from './users.model';

export type DemoMemorySchema = DemoUsersMemorySchema & DemoEventsMemorySchema;
