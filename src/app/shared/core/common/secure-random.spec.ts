import { secureRandomInt, secureRandomUuid } from './secure-random';

describe('secureRandomInt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects samples outside the evenly divisible range before selecting a shuffle index', () => {
    const getRandomValues = vi.fn()
      .mockImplementationOnce((sample: Uint32Array) => { sample[0] = 0xffffffff; return sample; })
      .mockImplementationOnce((sample: Uint32Array) => { sample[0] = 7; return sample; });
    vi.stubGlobal('crypto', { getRandomValues });
    expect(secureRandomInt(3)).toBe(1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid bounds and missing cryptographic randomness', () => {
    for (const bound of [0, -1, 1.5, Infinity, 0x100000001]) {
      expect(() => secureRandomInt(bound)).toThrow(RangeError);
    }
    vi.stubGlobal('crypto', undefined);
    expect(() => secureRandomInt(2)).toThrow('Secure random generator is unavailable');
  });
});

describe('secureRandomUuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the browser UUID generator when available', () => {
    const randomUUID = vi.fn().mockReturnValue('12345678-1234-4567-8901-123456789abc');
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });

    expect(secureRandomUuid()).toBe('12345678-1234-4567-8901-123456789abc');
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('uses cryptographic random bytes when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(secureRandomUuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it('fails closed without a cryptographic random generator', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => secureRandomUuid()).toThrow('Secure random generator is unavailable');
  });
});
