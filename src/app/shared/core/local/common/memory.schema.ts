import type { CommunityGroupsMemorySchema } from '../source/entity/community-group.entity';
import type { ContentModerationMemorySchema } from '../source/entity/content-moderation.entity';
import type { PhotoFeedMemorySchema } from '../source/entity/photo-feed.entity';
import type { MingleMemorySchema } from '../source/entity/mingle.entity';
import type {
  ActivityMembersMemorySchema,
  ActivityResourcesMemorySchema,
  ActivitySubEventGroupsMemorySchema,
  ActivitySubEventStageRuntimeMemorySchema
} from '../source/entity/activity.entity';
import type { AssetRequestsMemorySchema, AssetsMemorySchema } from '../source/entity/asset.entity';
import type { ChatsMemorySchema } from '../source/entity/chat.entity';
import type { HelpCenterMemorySchema, IdeaPostsMemorySchema } from '../source/entity/content.entity';
import type { ActivityEventsMemorySchema, EventFeedbackMemorySchema } from '../source/entity/event.entity';
import type { EventTicketsMemorySchema } from '../source/entity/event-ticket.entity';
import type { NotificationsMemorySchema } from '../source/entity/notification.entity';
import type { ContactsMemorySchema, ProfileExperiencesMemorySchema } from '../source/entity/profile.entity';
import type { UserRatesMemorySchema } from '../source/entity/rate.entity';
import type { ShareTokensMemorySchema } from '../source/entity/sharing.entity';
import type { UsersMemorySchema } from '../source/entity/user.entity';

export type AppMemorySchema = CommunityGroupsMemorySchema & UsersMemorySchema
  & UserRatesMemorySchema
  & AssetsMemorySchema
  & AssetRequestsMemorySchema
  & ActivityMembersMemorySchema
  & ActivityResourcesMemorySchema
  & ActivitySubEventGroupsMemorySchema
  & ActivitySubEventStageRuntimeMemorySchema
  & ChatsMemorySchema
  & NotificationsMemorySchema
  & EventFeedbackMemorySchema
  & EventTicketsMemorySchema
  & HelpCenterMemorySchema
  & IdeaPostsMemorySchema
  & PhotoFeedMemorySchema
  & ContentModerationMemorySchema
  & ContactsMemorySchema
  & ProfileExperiencesMemorySchema
  & ShareTokensMemorySchema
  & ActivityEventsMemorySchema
  & MingleMemorySchema;
