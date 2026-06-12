import type { HelpCenterState } from './popup.model';
import type { IdeaPostDto } from '../../contracts/content.interface';
import type { UserLocationEligibilityResponseDto } from '../../contracts/user.interface';

export interface LandingContentState {
  privacy: HelpCenterState;
  terms: HelpCenterState;
  ideas: IdeaPostDto[];
  loginAvailability: UserLocationEligibilityResponseDto | null;
}
