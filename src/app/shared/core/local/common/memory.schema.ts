import type {
  ActivityMembersMemorySchema,
  ActivityResourcesMemorySchema,
  ActivitySubEventGroupsMemorySchema,
  ActivitySubEventStageRuntimeMemorySchema
} from '../source/entity/activity.entity';
import type { AssetsMemorySchema } from '../source/entity/asset.entity';
import type { ChatsMemorySchema } from '../source/entity/chat.entity';
import type { HelpCenterMemorySchema, IdeaPostsMemorySchema } from '../source/entity/content.entity';
import type { ActivityEventsMemorySchema, EventFeedbackMemorySchema } from '../source/entity/event.entity';
import type { ContactsMemorySchema, ProfileExperiencesMemorySchema } from '../source/entity/profile.entity';
import type { UserRatesMemorySchema } from '../source/entity/rate.entity';
import type { ShareTokensMemorySchema } from '../source/entity/sharing.entity';
import type { UsersMemorySchema } from '../source/entity/user.entity';

export type AppMemorySchema = UsersMemorySchema
  & UserRatesMemorySchema
  & AssetsMemorySchema
  & ActivityMembersMemorySchema
  & ActivityResourcesMemorySchema
  & ActivitySubEventGroupsMemorySchema
  & ActivitySubEventStageRuntimeMemorySchema
  & ChatsMemorySchema
  & EventFeedbackMemorySchema
  & HelpCenterMemorySchema
  & IdeaPostsMemorySchema
  & ContactsMemorySchema
  & ProfileExperiencesMemorySchema
  & ShareTokensMemorySchema
  & ActivityEventsMemorySchema;
