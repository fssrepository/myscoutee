import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import type { HelpCenterSection } from '../../../shared/app-types';

@Component({
  selector: 'app-navigator-help-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-help-popup.component.html',
  styleUrl: './navigator-help-popup.component.scss'
})
export class NavigatorHelpPopupComponent {
  protected readonly sections: HelpCenterSection[] = APP_STATIC_DATA.helpCenterSections;
  protected activeSectionId = this.sections[0]?.id ?? 'events';

  protected selectSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.activeSectionId = sectionId;
  }

  protected get activeSection(): HelpCenterSection | null {
    return this.sections.find(section => section.id === this.activeSectionId) ?? this.sections[0] ?? null;
  }
}
