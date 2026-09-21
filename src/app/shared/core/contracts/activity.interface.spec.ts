import { describe, expect, it } from 'vitest';

import { ActivityEventDetailDTO } from './activity.interface';

describe('ActivityEventDetailDTO Mingle configuration', () => {
  it('keeps a new Mingle event unconfigured until configuration is provided', () => {
    const event = new ActivityEventDetailDTO().apply({ mode: 'Mingle' });

    expect(event.mingleConfiguration).toBeNull();
  });
});
