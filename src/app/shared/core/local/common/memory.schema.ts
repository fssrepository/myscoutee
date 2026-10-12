import type { ServiceOfferingsMemorySchema } from '../source/entity/community/service-offering.entity';
import type { CommunityAnnouncementsMemorySchema } from '../source/entity/community/community-announcement.entity';
import type { CommunityCasesMemorySchema } from '../source/entity/community/community-case.entity';
import type { CampaignsMemorySchema } from '../source/entity/campaigns/campaign.entity';
import type { CommunityGroupsMemorySchema } from '../source/entity/groups/community-group.entity';
import type { ContentModerationMemorySchema } from '../source/entity/content/content-moderation.entity';
import type { PhotoFeedMemorySchema } from '../source/entity/content/photo-feed.entity';
import type { MingleMemorySchema } from '../source/entity/events/mingle.entity';
import type {
  ActivityMembersMemorySchema,
  ActivityResourcesMemorySchema,
  ActivitySubEventGroupsMemorySchema,
  ActivitySubEventStageRuntimeMemorySchema
} from '../source/entity/common/activity.entity';
import type { AssetRequestsMemorySchema, AssetsMemorySchema } from '../source/entity/assets/asset.entity';
import type { ChatsMemorySchema } from '../source/entity/chat/chat.entity';
import type { HelpCenterMemorySchema, IdeaPostsMemorySchema } from '../source/entity/content/content.entity';
import type { ActivityEventsMemorySchema, EventFeedbackMemorySchema } from '../source/entity/events/event.entity';
import type { EventTicketsMemorySchema } from '../source/entity/events/event-ticket.entity';
import type { NotificationsMemorySchema } from '../source/entity/notifications/notification.entity';
import type { ContactsMemorySchema, ProfileExperiencesMemorySchema } from '../source/entity/accounts/profile.entity';
import type { UserRatesMemorySchema } from '../source/entity/affinity/rate.entity';
import type { ShareTokensMemorySchema } from '../source/entity/content/sharing.entity';
import type { UsersMemorySchema } from '../source/entity/accounts/user.entity';

export type AppMemorySchema = ServiceOfferingsMemorySchema & CommunityAnnouncementsMemorySchema & CommunityCasesMemorySchema & CampaignsMemorySchema & CommunityGroupsMemorySchema & UsersMemorySchema
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
