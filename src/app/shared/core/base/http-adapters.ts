import { HttpActivityInviteCandidatesService } from '../http/services/events/activity-invite-candidates.service';
import { HttpActivityMembersService } from '../http/services/events/activity-members.service';
import { HttpActivityResourcesService } from '../http/services/events/activity-resources.service';
import { HttpAdminAffinityGraphService } from '../http/services/affinity/admin-affinity-graph.service';
import { HttpAdminModerationService } from '../http/services/content/admin-moderation.service';
import { HttpAdminMonitoringService } from '../http/services/administration/admin-monitoring.service';
import { HttpAdminNotificationsService } from '../http/services/administration/admin-notifications.service';
import { HttpAdminParamsService } from '../http/services/affinity/admin-params.service';
import { HttpAdminStatsService } from '../http/services/administration/admin-stats.service';
import { HttpAdminWorkspaceService } from '../http/services/administration/admin-workspace.service';
import { HttpAssetTicketsService } from '../http/services/assets/asset-tickets.service';
import { HttpAssetsService } from '../http/services/assets/assets.service';
import { HttpCampaignsService } from '../http/services/campaigns/campaigns.service';
import { HttpCaseAppointmentsService } from '../http/services/community/case-appointments.service';
import { HttpChatsService } from '../http/services/chat/chats.service';
import { HttpCommunityAnnouncementsService } from '../http/services/community/community-announcements.service';
import { HttpCommunityCasesService } from '../http/services/community/community-cases.service';
import { HttpCommunityGroupsService } from '../http/services/groups/community-groups.service';
import { HttpContactsService } from '../http/services/accounts/contacts.service';
import { HttpContentModerationService } from '../http/services/content/content-moderation.service';
import { HttpDeploymentConfigurationService } from '../http/services/platform/deployment-configuration.service';
import { HttpDeviceRegistrationsService } from '../http/services/accounts/device-registrations.service';
import { HttpEventsService } from '../http/services/events/events.service';
import { HttpFeedbackService } from '../http/services/feedback/feedback.service';
import { HttpFollowingService } from '../http/services/accounts/following.service';
import { HttpGameService } from '../http/services/accounts/game.service';
import { HttpHelpCenterService } from '../http/services/help/help-center.service';
import { HttpIdeaPostsService } from '../http/services/content/idea-posts.service';
import { HttpIntegrationService } from '../http/services/integrations/integration.service';
import { HttpLandingContentService } from '../http/services/content/landing-content.service';
import { HttpMediaService } from '../http/services/media/media.service';
import { HttpNotificationsService } from '../http/services/notifications/notifications.service';
import { HttpOperatorEmailService } from '../http/services/email/operator-email.service';
import { HttpOperatorRegistryService } from '../http/services/operator/operator-registry.service';
import { HttpPaymentMethodsService } from '../http/services/payments/payment-methods.service';
import { HttpPhotoFeedService } from '../http/services/content/photo-feed.service';
import { HttpRatesService } from '../http/services/affinity/rates.service';
import { HttpServiceOfferingsService } from '../http/services/community/service-offerings.service';
import { HttpShareTokensService } from '../http/services/content/share-tokens.service';
import { HttpUserExperiencesService } from '../http/services/accounts/user-experiences.service';
import { HttpUsersService } from '../http/services/accounts/users.service';

// Constructor references only; instances remain owned and cached by Angular.
export const HTTP_ADAPTER_TYPES = {
  HttpActivityInviteCandidatesService,
  HttpActivityMembersService,
  HttpActivityResourcesService,
  HttpAdminAffinityGraphService,
  HttpAdminModerationService,
  HttpAdminMonitoringService,
  HttpAdminNotificationsService,
  HttpAdminParamsService,
  HttpAdminStatsService,
  HttpAdminWorkspaceService,
  HttpAssetTicketsService,
  HttpAssetsService,
  HttpCampaignsService,
  HttpCaseAppointmentsService,
  HttpChatsService,
  HttpCommunityAnnouncementsService,
  HttpCommunityCasesService,
  HttpCommunityGroupsService,
  HttpContactsService,
  HttpContentModerationService,
  HttpDeploymentConfigurationService,
  HttpDeviceRegistrationsService,
  HttpEventsService,
  HttpFeedbackService,
  HttpFollowingService,
  HttpGameService,
  HttpHelpCenterService,
  HttpIdeaPostsService,
  HttpIntegrationService,
  HttpLandingContentService,
  HttpMediaService,
  HttpNotificationsService,
  HttpOperatorEmailService,
  HttpOperatorRegistryService,
  HttpPaymentMethodsService,
  HttpPhotoFeedService,
  HttpRatesService,
  HttpServiceOfferingsService,
  HttpShareTokensService,
  HttpUserExperiencesService,
  HttpUsersService
};
