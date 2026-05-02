import type { DemoAssetsMemorySchema } from './assets.model';
import type { DemoActivityMembersMemorySchema } from './activity-members.model';
import type { DemoActivityResourcesMemorySchema } from './activity-resources.model';
import type { DemoChatsMemorySchema } from './chats.model';
import type { DemoEventFeedbackMemorySchema } from './event-feedback.model';
import type { DemoEventsMemorySchema } from './events.model';
import type { DemoHelpCenterMemorySchema } from './help-center.model';
import type { DemoIdeaPostsMemorySchema } from './idea-posts.model';
import type { DemoProfileExperiencesMemorySchema } from './profile-experiences.model';
import type { DemoShareTokensMemorySchema } from './share-tokens.model';
import type { DemoUsersMemorySchema } from './users.model';

export type DemoMemorySchema = DemoUsersMemorySchema
  & DemoAssetsMemorySchema
  & DemoActivityMembersMemorySchema
  & DemoActivityResourcesMemorySchema
  & DemoChatsMemorySchema
  & DemoEventFeedbackMemorySchema
  & DemoHelpCenterMemorySchema
  & DemoIdeaPostsMemorySchema
  & DemoProfileExperiencesMemorySchema
  & DemoShareTokensMemorySchema
  & DemoEventsMemorySchema;
