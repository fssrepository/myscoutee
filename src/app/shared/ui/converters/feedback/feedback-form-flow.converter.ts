import { APP_STATIC_DATA } from '../../../core/common/app-static-data';
import type * as AppTypes from './feedback.model';
import { FeedbackDetailDto } from '../../../core/contracts/feedback/feedback.interface';
import {
  type AppMenuItem,
  type AppMenuModel,
  type AppMenuPalette,
  type FormFlowMenuControlConfig,
  type FormFlowModel
} from '@fssrepository/myscoutee-components';

import {
  FeedbackDetailConverter,
  FeedbackDetailImageCardConverter,
  FeedbackDetailInfoCardConverter
} from './feedback-detail.converter';

export interface FeedbackFormFlowConverterOptions {
  eventTitle?: string | null;
}

type FeedbackOptionMenuContext = {
  cardId: string;
  group: 'primary' | 'secondary' | 'traits';
};

export class FeedbackFormFlowConverter {
  static convert(
    detail: FeedbackDetailDto | null | undefined,
    options: FeedbackFormFlowConverterOptions = {}
  ): FormFlowModel {
    const normalizedDetail = new FeedbackDetailDto(detail);
    const cards = FeedbackDetailConverter.convert(normalizedDetail);
    return {
      title: 'feedback',
      subtitle: options.eventTitle?.trim() || normalizedDetail.title,
      layout: 'carousel',
      loadingLabel: 'feedback.loading',
      save: {
        label: 'submit.feedback',
        ariaLabel: 'submit.feedback',
        icon: 'send'
      },
      summary: {
        title: 'form.summary.title',
        subtitle: 'feedback.evaluation.overview.description',
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
          imageCard: card.kind === 'event' ? null : FeedbackDetailImageCardConverter.convert(card),
          infoCard: card.kind === 'event' ? FeedbackDetailInfoCardConverter.convert(card) : null,
          imageUrl: card.imageUrl,
          icon: card.icon
        },
        controls: [
          {
            id: `${card.id}-primary`,
            guideFieldId: 'feedback-primary',
            kind: 'menu',
            label: card.questionPrimary,
            bind: ['cards', cardIndex, 'answerPrimary'],
            required: true,
            config: this.inlineTabsMenuConfig(this.primaryOptionModel(card))
          },
          {
            id: `${card.id}-secondary`,
            guideFieldId: 'feedback-secondary',
            kind: 'menu',
            label: card.questionSecondary,
            bind: ['cards', cardIndex, 'answerSecondary'],
            required: true,
            config: this.inlineTabsMenuConfig(this.secondaryOptionModel(card))
          },
          {
            id: `${card.id}-traits`,
            guideFieldId: 'feedback-traits',
            kind: 'menu',
            layout: 'wide' as const,
            label: card.traitQuestion,
            description: 'feedback.traits.limit.description',
            bind: ['cards', cardIndex, 'selectedTraitIds'],
            required: true,
            config: this.inlineTabsMenuConfig(this.traitOptionModel(card))
          },
          ...(card.kind === 'event' ? [{
            id: `${card.id}-comment`,
            guideFieldId: 'feedback-comment',
            kind: 'textarea' as const,
            layout: 'wide' as const,
            label: 'feedback.event.opinion.title',
            description: 'feedback.event.opinion.limit.description',
            placeholder: 'feedback.event.opinion.placeholder',
            bind: ['cards', cardIndex, 'eventComment'] as const,
            rows: 3,
            maxLength: 160
          }] : [])
        ]
      }))
    };
  }

  private static inlineTabsMenuConfig(
    model: AppMenuModel<string, FeedbackOptionMenuContext>
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
    card: AppTypes.FeedbackCard
  ): AppMenuModel<string, FeedbackOptionMenuContext> {
    return this.optionModel(
      `${card.id}-primary-options`,
      card.primaryOptions.map(option => this.optionMenuItem(card, 'primary', option))
    );
  }

  private static secondaryOptionModel(
    card: AppTypes.FeedbackCard
  ): AppMenuModel<string, FeedbackOptionMenuContext> {
    return this.optionModel(
      `${card.id}-secondary-options`,
      card.secondaryOptions.map(option => this.optionMenuItem(card, 'secondary', option))
    );
  }

  private static traitOptionModel(
    card: AppTypes.FeedbackCard
  ): AppMenuModel<string, FeedbackOptionMenuContext> {
    const items = card.traitOptions.map((trait): AppMenuItem<string, FeedbackOptionMenuContext> => {
      return {
        id: `${card.id}-trait-${trait.id}`,
        label: APP_STATIC_DATA.personalityTraitCatalog.find(item => item.id === trait.id)?.labelKey ?? trait.label,
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
    card: AppTypes.FeedbackCard,
    group: 'primary' | 'secondary',
    option: AppTypes.FeedbackOption
  ): AppMenuItem<string, FeedbackOptionMenuContext> {
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
    items: readonly AppMenuItem<string, FeedbackOptionMenuContext>[],
    maxSelected: number | null = null
  ): AppMenuModel<string, FeedbackOptionMenuContext> {
    return {
      layout: 'tabs',
      maxSelected,
      groups: [{
        id,
        items
      }]
    };
  }

  private static optionPalette(option: AppTypes.FeedbackOption): AppMenuPalette {
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

  private static traitPalette(trait: AppTypes.FeedbackTraitOption): AppMenuPalette {
    const lookup = `${trait.id} ${trait.label} ${trait.coreVibe}`.toLowerCase();
    const palettes: Array<[AppMenuPalette, readonly string[]]> = [
      ['violet', ['creative']], ['pink', ['empath', 'kind', 'nurtur']],
      ['green', ['reliable', 'trust', 'stable']], ['cyan', ['adventur', 'energetic', 'bold']],
      ['blue', ['think', 'reflect', 'intellectual']], ['teal', ['social', 'magnetic', 'talk']],
      ['orange', ['playful', 'fun', 'lighthearted']], ['sky', ['ambitious', 'driven', 'goal']]
    ];
    return palettes.find(([, tokens]) => tokens.some(token => lookup.includes(token)))?.[0] ?? 'blue';
  }
}
