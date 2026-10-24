import { HttpDeploymentConfigurationService } from '../http/services/platform/deployment-configuration.service';
import { HttpHelpCenterService } from '../http/services/help/help-center.service';
import { HttpIdeaPostsService } from '../http/services/content/idea-posts.service';
import { HttpLandingContentService } from '../http/services/content/landing-content.service';
import { HttpMediaService } from '../http/services/media/media.service';

// Public entry surfaces: landing, documents, articles, authentication and media.
// Workspace constructors remain in the existing shared workspace load.
export const HTTP_ENTRY_ADAPTER_TYPES = {
  HttpDeploymentConfigurationService,
  HttpHelpCenterService,
  HttpIdeaPostsService,
  HttpLandingContentService,
  HttpMediaService
};
