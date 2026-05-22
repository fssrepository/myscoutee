import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ExplanationGuideService } from '../../../core';
import { I18nPipe } from '../../../i18n';

type HomeFilterModeOption = Readonly<{
  key: string;
  label: string;
  icon: string;
}>;

@Component({
  selector: 'app-explanation-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, I18nPipe],
  templateUrl: './explanation-popup.component.html',
  styleUrl: './explanation-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExplanationPopupComponent {
  protected readonly guide = inject(ExplanationGuideService);
  protected readonly activeRevision = this.guide.visibleRevision;
  protected readonly homeFilterModeOptionsEn: ReadonlyArray<HomeFilterModeOption> = [
    { key: 'single', label: 'Preferences', icon: 'person' },
    { key: 'friends-in-common', label: 'Friends in Common', icon: 'diversity_3' },
    { key: 'separated-friends', label: 'Inside Network', icon: 'group_add' },
    { key: 'pair', label: 'Outside Network', icon: 'groups' }
  ];
  protected readonly homeFilterModeOptionsHu: ReadonlyArray<HomeFilterModeOption> = [
    { key: 'single', label: 'Preferenciák', icon: 'person' },
    { key: 'friends-in-common', label: 'Közös ismerősök', icon: 'diversity_3' },
    { key: 'separated-friends', label: 'Hálózaton belül', icon: 'group_add' },
    { key: 'pair', label: 'Hálózaton kívül', icon: 'groups' }
  ];

  protected homeFilterModeOptions(lang: string | null | undefined): ReadonlyArray<HomeFilterModeOption> {
    return lang === 'hu'
      ? this.homeFilterModeOptionsHu
      : this.homeFilterModeOptionsEn;
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.guide.dismiss();
  }
}
