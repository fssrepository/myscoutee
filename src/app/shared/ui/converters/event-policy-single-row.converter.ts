import type * as EventContracts from '../../core/contracts/event.interface';
import type {
  SingleRowData
} from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface EventPolicySingleRowConverterOptions {
  index?: number;
  locked?: boolean;
  requiredApprovalLabel?: string;
  optionalPolicyLabel?: string;
  requiredPreview?: string;
  optionalPreview?: string;
}

interface ResolvedEventPolicySingleRowConverterOptions extends EventPolicySingleRowConverterOptions {
  index: number;
  locked: boolean;
  requiredApprovalLabel: string;
  optionalPolicyLabel: string;
  requiredPreview: string;
  optionalPreview: string;
}

export class EventPolicySingleRowConverter {
  static convert(
    policy: EventContracts.EventPolicyDTO,
    options: EventPolicySingleRowConverterOptions
  ): SingleRowData<EventContracts.EventPolicyDTO> {
    const resolved = this.resolveOptions(options);
    const title = `${policy.title ?? ''}`.trim() || `Policy ${resolved.index + 1}`;
    const required = policy.required !== false;
    return {
      id: `${policy.id ?? ''}`.trim() || `policy-${resolved.index + 1}`,
      title,
      subtitle: required ? resolved.requiredApprovalLabel : resolved.optionalPolicyLabel,
      detail: this.preview(policy, resolved),
      icon: 'policy',
      avatarShape: 'circle',
      surfaceTone: required ? 'accent' : 'neutral',
      clickable: true,
      menuActions: resolved.locked ? [] : ['delete'],
      eagerDetail: { ...policy }
    };
  }

  static convertList(
    policies: readonly EventContracts.EventPolicyDTO[],
    options: EventPolicySingleRowConverterOptions = {}
  ): SingleRowData<EventContracts.EventPolicyDTO>[] {
    return (policies ?? []).map((policy, index) => this.convert(policy, {
      ...options,
      index
    }));
  }

  private static preview(
    policy: EventContracts.EventPolicyDTO,
    options: ResolvedEventPolicySingleRowConverterOptions
  ): string {
    const description = `${policy.description ?? ''}`.trim();
    if (description) {
      return description;
    }
    return policy.required !== false ? options.requiredPreview : options.optionalPreview;
  }

  private static resolveOptions(
    options: EventPolicySingleRowConverterOptions
  ): ResolvedEventPolicySingleRowConverterOptions {
    return {
      index: Math.max(0, Math.trunc(Number(options.index) || 0)),
      locked: options.locked === true,
      requiredApprovalLabel: options.requiredApprovalLabel?.trim() || 'Required approval',
      optionalPolicyLabel: options.optionalPolicyLabel?.trim() || 'Optional policy',
      requiredPreview: options.requiredPreview?.trim() || 'Attendees must approve this policy before joining.',
      optionalPreview: options.optionalPreview?.trim() || 'Optional policy shown during join or checkout.'
    };
  }
}

export const eventPolicySingleRowConverter =
  EventPolicySingleRowConverter satisfies UiListConverter<
    EventContracts.EventPolicyDTO,
    SingleRowData<EventContracts.EventPolicyDTO>,
    EventPolicySingleRowConverterOptions
  >;
