import type { DemoAssetsMemorySchema } from './assets.model';
import type { DemoActivityMembersMemorySchema } from './activity-members.model';
import type { DemoActivityResourcesMemorySchema } from './activity-resources.model';
import type { DemoChatsMemorySchema } from './chats.model';
import type { DemoEventFeedbackMemorySchema } from './event-feedback.model';
import type { DemoEventsMemorySchema } from './events.model';
import type { DemoProfileExperiencesMemorySchema } from './profile-experiences.model';
import type { DemoUsersMemorySchema } from './users.model';

export type DemoMemorySchema = DemoUsersMemorySchema
  & DemoAssetsMemorySchema
  & DemoActivityMembersMemorySchema
  & DemoActivityResourcesMemorySchema
  & DemoChatsMemorySchema
  & DemoEventFeedbackMemorySchema
  & DemoProfileExperiencesMemorySchema
  & DemoEventsMemorySchema;
