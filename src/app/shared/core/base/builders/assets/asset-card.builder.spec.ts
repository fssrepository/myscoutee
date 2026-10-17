import { AssetCardBuilder } from './asset-card.builder';

describe('Legacy asset image host classification', () => {
  it.each(['https://loremflickr.com/800/600', 'http://www.loremflickr.com/800/600'])('removes images from the actual legacy service: %s', value => {
    expect(AssetCardBuilder.normalizeAssetLink(value)).toBe('');
  });
  it.each(['https://loremflickr.com.evil.test/image', 'https://evil.test/loremflickr.com/image', 'https://evil.test/image?ref=loremflickr.com/', 'https://loremflickr.com@evil.test/image'])('preserves unrelated image URLs: %s', value => {
    expect(AssetCardBuilder.normalizeAssetLink(value)).toBe(value);
  });
});
