import type * as AppTypes from '../models';
import { EventFeedbackDetailDto } from '../../core/contracts/activity.interface';
import type {
  AppMenuItem,
  AppMenuModel,
  AppMenuPalette
} from '../components/core/menu';
import type { FormFlowMenuControlConfig, FormFlowModel } from '../components/core/form/flow';
import type { UiConverter } from './converter.types';
import {
  EventFeedbackDetailConverter,
  EventFeedbackDetailImageCardConverter,
  EventFeedbackDetailInfoCardConverter
} from './event-feedback-detail.converter';

export interface EventFeedbackFormFlowConverterOptions {
  eventTitle?: string | null;
}

type EventFeedbackOptionMenuContext = {
  cardId: string;
  group: 'primary' | 'secondary' | 'traits';
};

export class EventFeedbackFormFlowConverter {
  static convert(
    detail: EventFeedbackDetailDto | null | undefined,
    options: EventFeedbackFormFlowConverterOptions = {}
  ): FormFlowModel {
    const normalizedDetail = new EventFeedbackDetailDto(detail);
    const cards = EventFeedbackDetailConverter.convert(normalizedDetail);
    return {
      title: 'Event Feedback',
      subtitle: options.eventTitle?.trim() || normalizedDetail.title,
      layout: 'carousel',
      loadingLabel: 'Loading feedback',
      save: {
        label: 'Submit feedback',
        ariaLabel: 'Submit event feedback',
        icon: 'send'
      },
      summary: {
        title: 'Overview',
        subtitle: 'Review your answers before submitting.',
        icon: 'fact_check',
        includeEmpty: true
      },
      steps: cards.map((card, cardIndex) => ({
        id: card.id,
        title: card.kind === 'event' ? card.heading : card.identityTitle || card.heading,
        subtitle: card.subheading,
        icon: card.icon,
        header: {
          title: card.kind === 'event' ? card.heading : card.identityTitle || card.heading,
          subtitle: card.kind === 'event' ? card.subheading : card.identitySubtitle || card.subheading,
          imageCard: card.kind === 'event' ? null : EventFeedbackDetailImageCardConverter.convert(card),
          infoCard: card.kind === 'event' ? EventFeedbackDetailInfoCardConverter.convert(card) : null,
          imageUrl: card.imageUrl,
          icon: card.icon
        },
        controls: [
          {
            id: `${card.id}-primary`,
            kind: 'menu',
            label: card.questionPrimary,
            bind: ['cards', cardIndex, 'answerPrimary'],
            required: true,
            config: this.inlineTabsMenuConfig(this.primaryOptionModel(card))
          },
          {
            id: `${card.id}-secondary`,
            kind: 'menu',
            label: card.questionSecondary,
            bind: ['cards', cardIndex, 'answerSecondary'],
            required: true,
            config: this.inlineTabsMenuConfig(this.secondaryOptionModel(card))
          },
          {
            id: `${card.id}-traits`,
            kind: 'menu',
            label: card.traitQuestion,
            description: 'Pick up to 3',
            bind: ['cards', cardIndex, 'selectedTraitIds'],
            required: true,
            config: this.inlineTabsMenuConfig(this.traitOptionModel(card))
          }
        ]
      }))
    };
  }

  private static inlineTabsMenuConfig(
    model: AppMenuModel<string, EventFeedbackOptionMenuContext>
  ): FormFlowMenuControlConfig {
    return {
      kind: 'inline',
      layout: 'tabs',
      panelMode: 'anchored',
      model: model as AppMenuModel<string, unknown>,
      closeOnSelect: false
    };
  }

  private static primaryOptionModel(
    card: AppTypes.EventFeedbackCard
  ): AppMenuModel<string, EventFeedbackOptionMenuContext> {
    return this.optionModel(
      `${card.id}-primary-options`,
      card.primaryOptions.map(option => this.optionMenuItem(card, 'primary', option))
    );
  }

  private static secondaryOptionModel(
    card: AppTypes.EventFeedbackCard
  ): AppMenuModel<string, EventFeedbackOptionMenuContext> {
    return this.optionModel(
      `${card.id}-secondary-options`,
      card.secondaryOptions.map(option => this.optionMenuItem(card, 'secondary', option))
    );
  }

  private static traitOptionModel(
    card: AppTypes.EventFeedbackCard
  ): AppMenuModel<string, EventFeedbackOptionMenuContext> {
    const items = card.traitOptions.map((trait): AppMenuItem<string, EventFeedbackOptionMenuContext> => {
      return {
        id: `${card.id}-trait-${trait.id}`,
        label: trait.label,
        icon: trait.icon,
        kind: 'checkbox',
        value: trait.id,
        palette: this.traitPalette(trait),
        surface: 'tinted',
        closeOnSelect: false,
        context: {
          cardId: card.id,
          group: 'traits'
        }
      };
    });
    return this.optionModel(`${card.id}-trait-options`, items, 3);
  }

  private static optionMenuItem(
    card: AppTypes.EventFeedbackCard,
    group: 'primary' | 'secondary',
    option: AppTypes.EventFeedbackOption
  ): AppMenuItem<string, EventFeedbackOptionMenuContext> {
    return {
      id: `${card.id}-${group}-${option.value}`,
      label: option.label,
      icon: option.icon,
      kind: 'radio',
      value: option.value,
      palette: this.optionPalette(option),
      surface: 'tinted',
      closeOnSelect: false,
      context: { cardId: card.id, group }
    };
  }

  private static optionModel(
    id: string,
    items: readonly AppMenuItem<string, EventFeedbackOptionMenuContext>[],
    maxSelected: number | null = null
  ): AppMenuModel<string, EventFeedbackOptionMenuContext> {
    return {
      layout: 'tabs',
      maxSelected,
      groups: [{
        id,
        items
      }]
    };
  }

  private static optionPalette(option: AppTypes.EventFeedbackOption): AppMenuPalette {
    const impressionTag = `${option.impressionTag ?? ''}`.trim().toLowerCase();
    if (impressionTag.includes('reliab') || impressionTag.includes('trust') || impressionTag.includes('teamwork')) {
      return 'green';
    }
    if (impressionTag.includes('communicat') || impressionTag.includes('compat')) {
      return 'violet';
    }
    if (impressionTag.includes('organization') || impressionTag.includes('timing')) {
      return 'amber';
    }
    if (impressionTag.includes('planning') || impressionTag.includes('resource') || impressionTag.includes('quality')) {
      return 'mint';
    }
    if (impressionTag.includes('consistency') || impressionTag.includes('neutral')) {
      return 'slate';
    }
    if (impressionTag.includes('risk')) {
      return 'red';
    }
    if (impressionTag.includes('fit')) {
      return 'orange';
    }
    switch (option.value.trim().toLowerCase()) {
      case 'excellent':
      case 'great':
      case 'yes':
        return 'sky';
      case 'good':
      case 'reliable':
        return 'cyan';
      case 'mixed':
      case 'communication':
      case 'neutral':
      case 'maybe':
        return 'violet';
      case 'needs-work':
      case 'resources':
      case 'context':
        return 'mint';
      case 'timing':
      case 'rough':
        return 'amber';
      case 'none':
      case 'no':
        return 'slate';
      default:
        return 'sky';
    }
  }

  private static traitPalette(trait: AppTypes.EventFeedbackTraitOption): AppMenuPalette {
    const lookup = `${trait.id} ${trait.label} ${trait.coreVibe}`.toLowerCase();
    if (lookup.includes('creative')) {
      return 'violet';
    }
    if (lookup.includes('empath') || lookup.includes('kind') || lookup.includes('nurtur')) {
      return 'pink';
    }
    if (lookup.includes('reliable') || lookup.includes('trust') || lookup.includes('stable')) {
      return 'green';
    }
    if (lookup.includes('adventur') || lookup.includes('energetic') || lookup.includes('bold')) {
      return 'cyan';
    }
    if (lookup.includes('think') || lookup.includes('reflect') || lookup.includes('intellectual')) {
      return 'blue';
    }
    if (lookup.includes('social') || lookup.includes('magnetic') || lookup.includes('talk')) {
      return 'teal';
    }
    if (lookup.includes('playful') || lookup.includes('fun') || lookup.includes('lighthearted')) {
      return 'orange';
    }
    if (lookup.includes('ambitious') || lookup.includes('driven') || lookup.includes('goal')) {
      return 'sky';
    }
    return 'blue';
  }
}
