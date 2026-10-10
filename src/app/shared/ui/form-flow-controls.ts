import type { FormFlowControls, FormFlowControlContext } from '@myscoutee/components';
import { FormFlowPopupStore } from './components/core/form/flow/form-flow-popup.store';

function inputs(context: FormFlowControlContext) {
  return {config: (context.control.config as {model?: unknown} | null)?.model ?? {},
    readOnly: context.disabled, disabled: context.disabled};
}
export const MYSCOUTEE_FORM_FLOW_CONTROLS: FormFlowControls = {
  providers: [FormFlowPopupStore],
  renderers: {
    pricing: {
      load: () => import('./components/core/form/inputs/pricing-editor').then(m => m.PricingEditorInputComponent),
      inputs
    },
    policies: {
      load: () => import('./components/core/form/inputs/policies-input').then(m => m.PoliciesInputComponent),
      inputs: context => ({...inputs(context), enabled: context.enabled}),
      outputs: {enabledChange: (context, value) => context.changeEnabled(value === true)}
    }
  }
};
