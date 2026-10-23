import { LocalActivityInviteCandidatesService } from '../local/source/services/events/activity-invite-candidates.service';
import { LocalActivityMembersService } from '../local/source/services/events/activity-members.service';
import { LocalActivityResourcesService } from '../local/source/services/events/activity-resources.service';
import { LocalAdminAffinityGraphService } from '../local/source/services/affinity/admin-affinity-graph.service';
import { LocalAdminModerationService } from '../local/source/services/content/admin-moderation.service';
import { LocalAdminMonitoringService } from '../local/source/services/administration/admin-monitoring.service';
import { LocalAdminNotificationsService } from '../local/source/services/administration/admin-notifications.service';
import { LocalAdminParamsService } from '../local/source/services/affinity/admin-params.service';
import { LocalAdminStatsService } from '../local/source/services/administration/admin-stats.service';
import { LocalAdminWorkspaceService } from '../local/source/services/administration/admin-workspace.service';
import { LocalAssetTicketsService } from '../local/source/services/assets/asset-tickets.service';
import { LocalAssetsService } from '../local/source/services/assets/assets.service';
import { LocalCampaignsService } from '../local/source/services/campaigns/campaigns.service';
import { LocalCaseAppointmentsService } from '../local/source/services/community/case-appointments.service';
import { LocalChatsService } from '../local/source/services/chat/chats.service';
import { LocalCommunityAnnouncementsService } from '../local/source/services/community/community-announcements.service';
import { LocalCommunityCasesService } from '../local/source/services/community/community-cases.service';
import { LocalCommunityGroupsService } from '../local/source/services/groups/community-groups.service';
import { LocalContactsService } from '../local/source/services/accounts/contacts.service';
import { LocalContentModerationService } from '../local/source/services/content/content-moderation.service';
import { LocalDeploymentConfigurationService } from '../local/source/services/platform/deployment-configuration.service';
import { LocalDeviceRegistrationsService } from '../local/source/services/accounts/device-registrations.service';
import { LocalEventsService } from '../local/source/services/events/events.service';
import { LocalFeedbackService } from '../local/source/services/feedback/feedback.service';
import { LocalFollowingService } from '../local/source/services/accounts/following.service';
import { LocalGameService } from '../local/source/services/accounts/game.service';
import { LocalHelpCenterService } from '../local/source/services/help/help-center.service';
import { LocalIdeaPostsService } from '../local/source/services/content/idea-posts.service';
import { LocalIntegrationService } from '../local/source/services/integrations/integration.service';
import { LocalLandingContentService } from '../local/source/services/content/landing-content.service';
import { LocalMediaService } from '../local/source/services/media/media.service';
import { LocalNotificationsService } from '../local/source/services/notifications/notifications.service';
import { LocalOperatorEmailService } from '../local/source/services/email/operator-email.service';
import { LocalOperatorRegistryService } from '../local/source/services/operator/operator-registry.service';
import { LocalPaymentMethodsService } from '../local/source/services/payments/payment-methods.service';
import { LocalPhotoFeedService } from '../local/source/services/content/photo-feed.service';
import { LocalRatesService } from '../local/source/services/affinity/rates.service';
import { LocalServiceOfferingsService } from '../local/source/services/community/service-offerings.service';
import { LocalShareTokensService } from '../local/source/services/content/share-tokens.service';
import { LocalUserExperiencesService } from '../local/source/services/accounts/user-experiences.service';
import { LocalUsersService } from '../local/source/services/accounts/users.service';

// Constructor references only; instances remain owned and cached by Angular.
export const LOCAL_ADAPTER_TYPES = {
  LocalActivityInviteCandidatesService,
  LocalActivityMembersService,
  LocalActivityResourcesService,
  LocalAdminAffinityGraphService,
  LocalAdminModerationService,
  LocalAdminMonitoringService,
  LocalAdminNotificationsService,
  LocalAdminParamsService,
  LocalAdminStatsService,
  LocalAdminWorkspaceService,
  LocalAssetTicketsService,
  LocalAssetsService,
  LocalCampaignsService,
  LocalCaseAppointmentsService,
  LocalChatsService,
  LocalCommunityAnnouncementsService,
  LocalCommunityCasesService,
  LocalCommunityGroupsService,
  LocalContactsService,
  LocalContentModerationService,
  LocalDeploymentConfigurationService,
  LocalDeviceRegistrationsService,
  LocalEventsService,
  LocalFeedbackService,
  LocalFollowingService,
  LocalGameService,
  LocalHelpCenterService,
  LocalIdeaPostsService,
  LocalIntegrationService,
  LocalLandingContentService,
  LocalMediaService,
  LocalNotificationsService,
  LocalOperatorEmailService,
  LocalOperatorRegistryService,
  LocalPaymentMethodsService,
  LocalPhotoFeedService,
  LocalRatesService,
  LocalServiceOfferingsService,
  LocalShareTokensService,
  LocalUserExperiencesService,
  LocalUsersService
};
