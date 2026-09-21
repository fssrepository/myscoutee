import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  ActivityEventDetailDTO,
  type MingleConfigurationDTO
} from '../../../shared/core/contracts/activity.interface';
import { I18nService } from '../../../shared/core';
import {
  I18nPipe,
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui';

type MingleNumberField = Exclude<keyof MingleConfigurationDTO, 'requireGenderBalance'>;

interface MingleNumberFieldDefinition {
  key: MingleNumberField;
  label: string;
  icon: string;
  min: number;
  max: number;
  step: number;
  wide?: boolean;
  suffix?: string;
  hint?: string;
}

type MingleConfigurationMenuContext = { menu: 'save' };

@Component({
  selector: 'app-event-mingle-configuration-popup',
  standalone: true,
  imports: [MatIconModule, PopupComponent, I18nPipe],
  templateUrl: './event-mingle-configuration-popup.component.html',
  styleUrl: './event-mingle-configuration-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventMingleConfigurationPopupComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly configuration = input<MingleConfigurationDTO | null>(null);
  readonly readOnly = input(false);
  readonly allowRoundIncrease = input(false);
  readonly minimumPlannedRounds = input(1);

  readonly save = output<MingleConfigurationDTO>();
  readonly cancel = output<Event>();

  protected readonly draft = signal<MingleConfigurationDTO>(
    ActivityEventDetailDTO.normalizeMingleConfiguration(null)
  );

  protected readonly numberFields: readonly MingleNumberFieldDefinition[] = [
    {
      key: 'groupSize',
      label: 'event.editor.mingle.group.size',
      icon: 'groups',
      min: 2,
      max: 20,
      step: 1
    },
    {
      key: 'tableCount',
      label: 'event.editor.mingle.table.count',
      icon: 'table_restaurant',
      min: 0,
      max: 500,
      step: 1,
      hint: 'event.editor.mingle.table.count.hint'
    },
    {
      key: 'plannedRounds',
      label: 'event.editor.mingle.planned.rounds',
      icon: 'repeat',
      min: 1,
      max: 100,
      step: 1,
      wide: true,
      hint: 'event.editor.mingle.flexible.rounds.note'
    },
    {
      key: 'roundDurationMinutes',
      label: 'event.editor.mingle.round.duration',
      icon: 'timer',
      min: 1,
      max: 240,
      step: 1,
      suffix: 'minutes.short'
    },
    {
      key: 'breakDurationMinutes',
      label: 'event.editor.mingle.break.duration',
      icon: 'sync_alt',
      min: 0,
      max: 60,
      step: 1,
      suffix: 'minutes.short'
    }
  ];

  protected readonly popupModel = computed<PopupModel<MingleConfigurationMenuContext>>(() => ({
    title: 'event.editor.mingle.title',
    subtitle: 'event.editor.subevents.title',
    ariaLabel: 'event.editor.mingle.aria',
    closeAriaLabel: 'event.editor.mingle.close.aria',
    closeOnBackdrop: true,
    size: 'small',
    height: 'auto',
    mobilePresentation: 'compact',
    headerTone: 'accent',
    headerPalette: 'rose',
    bodyLayout: 'default',
    backdropTone: 'dim',
    headerControls: this.popupHeaderControls(),
    onClose: event => this.cancel.emit(event),
    onMenuSelect: event => this.onPopupMenuSelect(event)
  }));

  private wasOpen = false;

  constructor() {
    effect(() => {
      const open = this.open();
      const configuration = this.configuration();
      const minimumPlannedRounds = this.normalizedMinimumPlannedRounds();
      if (open && !this.wasOpen) {
        this.draft.set(this.normalizeDraft(configuration, minimumPlannedRounds));
        void this.i18n.revalidate();
      } else if (open && this.draft().plannedRounds < minimumPlannedRounds) {
        this.draft.update(current => ({
          ...current,
          plannedRounds: minimumPlannedRounds
        }));
      }
      this.wasOpen = open;
    });
  }

  protected fieldMinimum(field: MingleNumberField): number {
    const definition = this.numberFields.find(candidate => candidate.key === field);
    return field === 'plannedRounds'
      ? this.normalizedMinimumPlannedRounds()
      : definition?.min ?? 0;
  }

  protected fieldDisabled(field: keyof MingleConfigurationDTO): boolean {
    if (!this.open()) {
      return true;
    }
    if (!this.readOnly()) {
      return false;
    }
    return !(field === 'plannedRounds' && this.allowRoundIncrease());
  }

  protected updateNumber(field: MingleNumberField, event: Event): void {
    if (this.fieldDisabled(field)) {
      return;
    }
    const inputElement = event.target as HTMLInputElement | null;
    this.draft.update(current => this.normalizeDraft({
      ...current,
      [field]: Number(inputElement?.value)
    }, this.normalizedMinimumPlannedRounds()));
  }

  protected updateGenderBalance(event: Event): void {
    if (this.fieldDisabled('requireGenderBalance')) {
      return;
    }
    const inputElement = event.target as HTMLInputElement | null;
    this.draft.update(current => ({
      ...current,
      requireGenderBalance: inputElement?.checked === true
    }));
  }

  private popupHeaderControls(): readonly PopupControl<MingleConfigurationMenuContext>[] {
    if (this.readOnly() && !this.allowRoundIncrease()) {
      return [];
    }
    return [{
      kind: 'menu',
      id: 'mingle-configuration-save',
      menuKind: 'inline',
      closeOnSelect: false,
      items: [{
        id: 'save',
        icon: 'done',
        kind: 'action',
        palette: 'green',
        ariaLabel: 'event.editor.mingle.save.aria',
        context: { menu: 'save' }
      }]
    }];
  }

  private onPopupMenuSelect(event: PopupMenuSelectEvent<MingleConfigurationMenuContext>): void {
    if (event.itemSelect.context?.menu !== 'save') {
      return;
    }
    this.save.emit(this.normalizeDraft(this.draft(), this.normalizedMinimumPlannedRounds()));
  }

  private normalizedMinimumPlannedRounds(): number {
    return Math.min(100, Math.max(1, Math.trunc(Number(this.minimumPlannedRounds()) || 1)));
  }

  private normalizeDraft(
    configuration: MingleConfigurationDTO | null,
    minimumPlannedRounds: number
  ): MingleConfigurationDTO {
    const normalized = ActivityEventDetailDTO.normalizeMingleConfiguration(configuration);
    return {
      ...normalized,
      plannedRounds: Math.max(minimumPlannedRounds, normalized.plannedRounds)
    };
  }
}
