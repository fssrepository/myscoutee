import type { AssetsMemorySchema } from './assets.model';
import type { ActivityMembersMemorySchema } from './activity-members.model';
import type { ActivityResourcesMemorySchema } from './activity-resources.model';
import type { ChatsMemorySchema } from './chats.model';
import type { EventFeedbackMemorySchema } from './event-feedback.model';
import type { ActivityEventsMemorySchema } from './events.model';
import type { HelpCenterMemorySchema } from './help-center.model';
import type { IdeaPostsMemorySchema } from './idea-posts.model';
import type { ContactsMemorySchema } from './contacts.model';
import type { ProfileExperiencesMemorySchema } from './profile-experiences.model';
import type { ShareTokensMemorySchema } from './share-tokens.model';
import type { UsersMemorySchema } from './users.model';

export type AppMemorySchema = UsersMemorySchema
  & AssetsMemorySchema
  & ActivityMembersMemorySchema
  & ActivityResourcesMemorySchema
  & ChatsMemorySchema
  & EventFeedbackMemorySchema
  & HelpCenterMemorySchema
  & IdeaPostsMemorySchema
  & ContactsMemorySchema
  & ProfileExperiencesMemorySchema
  & ShareTokensMemorySchema
  & ActivityEventsMemorySchema;
