import type * as AppTypes from '../../core/base/models';
import type {
  EventFeedbackAnswerSubmitDto,
  EventFeedbackDeckResultDto,
  EventFeedbackSubmitRequestDto,
  SubmittedEventFeedbackAnswer
} from '../../core/contracts/activity.interface';
import type {
  AppMenuItem,
  AppMenuModel,
  AppMenuPalette
} from '../components/menu';
import type { FormFlowMenuControlConfig, FormFlowModel } from '../components/form-flow';
import {
  EventFeedbackDeckConverter,
  EventFeedbackDeckImageCardConverter,
  EventFeedbackDeckInfoCardConverter
} from './event-feedback-deck.converter';

export interface EventFeedbackFormFlowConverterOptions {
  eventTitle?: string | null;
}

export interface EventFeedbackPendingDeckOptions {
  activeUserId?: string | null;
  fallbackTitle?: string | null;
}

export interface EventFeedbackFormCardValue {
  id: string;
  answerPrimary: string;
  answerSecondary: string;
  selectedTraitIds: string[];
}

export interface EventFeedbackFormValue {
  eventId: string;
  cards: EventFeedbackFormCardValue[];
}

export interface EventFeedbackFormSubmitResult {
  request: EventFeedbackSubmitRequestDto;
  submittedAnswersByCardId: Record<string, SubmittedEventFeedbackAnswer>;
}

type EventFeedbackOptionMenuContext = {
  cardId: string;
  group: 'primary' | 'secondary' | 'traits';
};

export class EventFeedbackFormFlowConverter {
  static pendingDeck(
    deck: EventFeedbackDeckResultDto | null | undefined,
    options: EventFeedbackPendingDeckOptions = {}
  ): EventFeedbackDeckResultDto {
    const normalizedDeck = this.normalizeDeck(deck);
    const eventId = normalizedDeck.eventId;
    const activeUserId = options.activeUserId?.trim() ?? '';
    return {
      ...normalizedDeck,
      title: normalizedDeck.title || options.fallbackTitle?.trim() || '',
      cards: normalizedDeck.cards.filter(card =>
        card.eventId === eventId
        && !(card.kind === 'attendee' && card.attendeeUserId === activeUserId)
      )
    };
  }

  static emptyValue(eventId = ''): EventFeedbackFormValue {
    return {
      eventId: eventId.trim(),
      cards: []
    };
  }

  static initialValue(deck: EventFeedbackDeckResultDto | null | undefined): EventFeedbackFormValue {
    const normalizedDeck = this.normalizeDeck(deck);
    return {
      eventId: normalizedDeck.eventId,
      cards: normalizedDeck.cards.map(card => ({
        id: card.id,
        answerPrimary: '',
        answerSecondary: '',
        selectedTraitIds: []
      }))
    };
  }

  static normalizeValue(
    value: unknown,
    deck: EventFeedbackDeckResultDto | null | undefined
  ): EventFeedbackFormValue {
    const normalizedDeck = this.normalizeDeck(deck);
    const input = this.isRecord(value) ? value : {};
    const inputCards = Array.isArray(input['cards']) ? input['cards'] : [];
    const cardInputById = new Map<string, Record<string, unknown>>();
    for (const item of inputCards) {
      if (!this.isRecord(item)) {
        continue;
      }
      const cardId = `${item['id'] ?? ''}`.trim();
      if (cardId) {
        cardInputById.set(cardId, item);
      }
    }
    const uiCards = this.cardsForDeck(normalizedDeck);
    return {
      eventId: normalizedDeck.eventId,
      cards: uiCards.map(card => {
        const inputCard = cardInputById.get(card.id) ?? {};
        const answerPrimary = this.normalizeOptionValue(
          inputCard['answerPrimary'],
          card.primaryOptions.map(option => option.value)
        );
        const answerSecondary = this.normalizeOptionValue(
          inputCard['answerSecondary'],
          card.secondaryOptions.map(option => option.value)
        );
        return {
          id: card.id,
          answerPrimary,
          answerSecondary,
          selectedTraitIds: this.normalizeTraitIds(
            inputCard['selectedTraitIds'],
            card.traitOptions.map(option => option.id)
          )
        };
      })
    };
  }

  static submitResult(options: {
    userId: string;
    deck: EventFeedbackDeckResultDto | null | undefined;
    value: unknown;
    submittedAtIso: string;
  }): EventFeedbackFormSubmitResult | null {
    const userId = options.userId.trim();
    const deck = this.normalizeDeck(options.deck);
    if (!userId || !deck.eventId || deck.cards.length === 0) {
      return null;
    }
    const value = this.normalizeValue(options.value, deck);
    const valueByCardId = new Map(value.cards.map(card => [card.id, card]));
    const answers: EventFeedbackAnswerSubmitDto[] = [];
    const submittedAnswersByCardId: Record<string, SubmittedEventFeedbackAnswer> = {};
    for (const card of this.cardsForDeck(deck)) {
      const cardValue = valueByCardId.get(card.id);
      if (!cardValue) {
        continue;
      }
      const tags = this.selectedImpressionTags(card, cardValue);
      const answer: EventFeedbackAnswerSubmitDto = {
        cardId: card.id,
        kind: card.kind,
        targetUserId: card.targetUserId ?? null,
        targetRole: card.targetRole ?? 'Member',
        primaryValue: cardValue.answerPrimary,
        secondaryValue: cardValue.answerSecondary,
        personalityTraitIds: [...cardValue.selectedTraitIds],
        tags,
        submittedAtIso: options.submittedAtIso
      };
      answers.push(answer);
      submittedAnswersByCardId[card.id] = {
        ...answer,
        eventId: card.eventId
      };
    }
    if (answers.length === 0) {
      return null;
    }
    return {
      request: {
        userId,
        eventId: deck.eventId,
        answers
      },
      submittedAnswersByCardId
    };
  }

  static convert(
    deck: EventFeedbackDeckResultDto | null | undefined,
    options: EventFeedbackFormFlowConverterOptions = {}
  ): FormFlowModel {
    const normalizedDeck = this.normalizeDeck(deck);
    const cards = this.cardsForDeck(normalizedDeck);
    return {
      title: 'Event Feedback',
      subtitle: options.eventTitle?.trim() || normalizedDeck.title,
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
          imageCard: card.kind === 'event' ? null : EventFeedbackDeckImageCardConverter.convert(card),
          infoCard: card.kind === 'event' ? EventFeedbackDeckInfoCardConverter.convert(card) : null,
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

  private static cardsForDeck(deck: EventFeedbackDeckResultDto): AppTypes.EventFeedbackCard[] {
    return EventFeedbackDeckConverter.convert(deck);
  }

  private static normalizeDeck(deck: EventFeedbackDeckResultDto | null | undefined): EventFeedbackDeckResultDto {
    return {
      eventId: deck?.eventId?.trim() ?? '',
      title: deck?.title?.trim() ?? '',
      cards: (deck?.cards ?? []).map(card => ({
        ...card,
        id: card.id?.trim() ?? '',
        eventId: card.eventId?.trim() ?? '',
        kind: card.kind === 'attendee' ? 'attendee' as const : 'event' as const,
        attendeeUserId: card.attendeeUserId?.trim() || undefined,
        targetUserId: card.targetUserId?.trim() || undefined,
        eventTitle: card.eventTitle?.trim() ?? '',
        eventSubtitle: card.eventSubtitle?.trim() ?? '',
        eventImageUrl: card.eventImageUrl?.trim() ?? '',
        eventTimeframe: card.eventTimeframe?.trim() ?? '',
        eventStartAtIso: card.eventStartAtIso?.trim() ?? '',
        eventLabel: card.eventLabel?.trim() ?? '',
        targetName: card.targetName?.trim() ?? '',
        targetCity: card.targetCity?.trim() || undefined,
        targetTraitLabel: card.targetTraitLabel?.trim() || undefined,
        targetImageUrl: card.targetImageUrl?.trim() || undefined
      })).filter(card => card.id.length > 0 && card.eventId.length > 0)
    };
  }

  private static selectedImpressionTags(
    card: AppTypes.EventFeedbackCard,
    value: EventFeedbackFormCardValue
  ): string[] {
    const tags = new Set<string>();
    const primary = card.primaryOptions.find(option => option.value === value.answerPrimary)?.impressionTag;
    const secondary = card.secondaryOptions.find(option => option.value === value.answerSecondary)?.impressionTag;
    if (primary) {
      tags.add(primary);
    }
    if (secondary) {
      tags.add(secondary);
    }
    return [...tags];
  }

  private static normalizeOptionValue(value: unknown, allowedValues: readonly string[]): string {
    const normalizedValue = `${value ?? ''}`.trim();
    return allowedValues.includes(normalizedValue) ? normalizedValue : '';
  }

  private static normalizeTraitIds(value: unknown, allowedValues: readonly string[]): string[] {
    const requestedValues = Array.isArray(value)
      ? value
      : value === null || value === undefined || value === ''
        ? []
        : [value];
    const selectedTraitIds: string[] = [];
    for (const requestedValue of requestedValues) {
      const traitId = `${requestedValue ?? ''}`.trim();
      if (!traitId || !allowedValues.includes(traitId) || selectedTraitIds.includes(traitId)) {
        continue;
      }
      selectedTraitIds.push(traitId);
      if (selectedTraitIds.length >= 3) {
        break;
      }
    }
    return selectedTraitIds;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
