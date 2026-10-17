import { sanitizeHtml } from './html-sanitizer';
import { LocalIdeaPostsMapper } from '../local/source/mappers/content/idea-post.mapper';
import { SeedIdeaPostsBuilder } from '../local/seed/builders/content/idea-posts-seed.builder';
import { LocalHelpCenterService } from '../local/source/services/help/help-center.service';

type Normalizer = { normalizeHtml(value: string): string };
const normalizers: Array<[string, (value: string) => string]> = [
  ['shared sanitizer', value => sanitizeHtml(value)],
  ['article mapper', value => (LocalIdeaPostsMapper as unknown as Normalizer).normalizeHtml(value)],
  ['article seed', value => (SeedIdeaPostsBuilder as unknown as Normalizer).normalizeHtml(value)],
  ['help projection', value => (Object.create(LocalHelpCenterService.prototype) as Normalizer).normalizeHtml(value)]
];
const attacks = [
  '<p>Safe</p><script>alert(1)</script >',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<img src=x onerror=alert(1)>',
  '<img src=x oonnerror=alert(1) onload=alert(1)>',
  '<a href="java&#x73;cript:alert(1)">link</a>',
  '<svg><g onload=alert(1)></g></svg>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">'
];

describe.each(normalizers)('Rich text security: %s', (_name, normalize) => {
  it.each(attacks)('removes executable markup from %s', value => {
    const parsed = document.createElement('template');
    parsed.innerHTML = normalize(value);
    expect(parsed.content.querySelector('script, iframe, object, embed, svg, math')).toBeNull();
    for (const element of parsed.content.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        expect(attribute.name.toLowerCase().startsWith('on')).toBe(false);
        if (['href', 'src', 'xlink:href'].includes(attribute.name)) {
          expect(new URL(attribute.value, 'https://safe.test').protocol).not.toBe('javascript:');
        }
      }
    }
  });

  it('retains formatted text, lists, images and lazy-image metadata', () => {
    const value = '<p class="intro"><strong>Hello</strong></p><ul><li>One</li></ul><figure><img src="/assets/safe.png" data-lazy-src="/assets/safe.png" alt="Image"><figcaption>Caption</figcaption></figure>';
    const clean = normalize(value);
    expect(clean).toContain('<strong>Hello</strong>');
    expect(clean).toContain('<li>One</li>');
    expect(clean).toContain('src="/assets/safe.png"');
    expect(clean).toContain('data-lazy-src="/assets/safe.png"');
    expect(clean).toContain('<figcaption>Caption</figcaption>');
  });
});
