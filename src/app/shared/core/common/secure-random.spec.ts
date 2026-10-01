import { secureRandomUuid } from './secure-random';

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
