export function secureRandomInt(exclusiveMaximum: number): number {
  if (!Number.isInteger(exclusiveMaximum) || exclusiveMaximum < 1 || exclusiveMaximum > 0x100000000) {
    throw new RangeError('Random integer bound must be between 1 and 2^32');
  }
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random generator is unavailable');
  }
  const limit = 0x100000000 - (0x100000000 % exclusiveMaximum);
  const sample = new Uint32Array(1);
  do {
    cryptoApi.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % exclusiveMaximum;
}

export function secureRandomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random generator is unavailable');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
