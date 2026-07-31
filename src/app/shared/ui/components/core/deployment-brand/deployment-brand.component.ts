import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject
} from '@angular/core';

import { DeploymentConfigurationService } from '../../../../core/base/services/deployment-configuration.service';
import type { DeploymentBrandingDto } from '../../../../core/contracts/deployment-configuration.interface';

interface DeploymentBrandRenderModel {
  readonly branding: DeploymentBrandingDto;
  readonly inlineLogo: boolean;
  readonly beforeLogo: string;
  readonly afterLogo: string;
}

@Component({
  selector: 'app-deployment-brand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deployment-brand.component.html',
  styleUrl: './deployment-brand.component.scss'
})
export class DeploymentBrandComponent {
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);

  @Input() branding: DeploymentBrandingDto | null = null;
  @Input() ariaLabel: string | null = null;

  protected renderModel(): DeploymentBrandRenderModel {
    const branding = this.branding ?? this.deploymentConfiguration.branding();
    const characters = Array.from(branding.productName);
    const index = branding.logoCharacterIndex ?? 0;
    return {
      branding,
      inlineLogo: true,
      beforeLogo: characters.slice(0, index).join(''),
      afterLogo: characters.slice(index + 1).join('')
    };
  }
}
