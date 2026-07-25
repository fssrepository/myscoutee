import { describe, expect, it } from 'vitest';

import type { AppMenuItem } from './menu.types';
import { appMenuAlertCounter } from './menu-summary';

describe('appMenuAlertCounter', () => {
  it('aggregates red item counters for the shared three-dot trigger', () => {
    const items: AppMenuItem[] = [
      {
        id: 'view',
        counter: { value: 1, max: 99 },
        counterTone: 'alert'
      },
      {
        id: 'neutral-total',
        counter: 45,
        counterTone: 'default'
      },
      {
        id: 'runtime',
        counter: 2,
        counterTone: 'alert'
      }
    ];

    expect(appMenuAlertCounter(items)).toEqual({ value: 3, max: 99 });
  });
});
