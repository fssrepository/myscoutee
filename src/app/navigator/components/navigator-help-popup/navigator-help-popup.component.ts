
import { Component, computed, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterSection } from '../../../shared/core/base/models';

@Component({
  selector: 'app-navigator-help-popup',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './navigator-help-popup.component.html',
  styleUrl: './navigator-help-popup.component.scss'
})
export class NavigatorHelpPopupComponent {
  private readonly helpCenter = inject(HelpCenterService);
  protected readonly activeRevision = this.helpCenter.activeRevision;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultHelpDescription = APP_STATIC_DATA.defaultHelpCenterDescription;
  protected openAccordionSectionId: string | null = null;

  constructor() {
    void this.helpCenter.preload();
    effect(() => {
      const sections = this.sections();
      if (sections.length === 0) {
        this.openAccordionSectionId = null;
        return;
      }
      if (!this.openAccordionSectionId || !sections.some(section => section.id === this.openAccordionSectionId)) {
        this.openAccordionSectionId = sections[0].id;
      }
    });
  }

  protected toggleAccordionSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openAccordionSectionId = this.openAccordionSectionId === sectionId ? null : sectionId;
  }
}
