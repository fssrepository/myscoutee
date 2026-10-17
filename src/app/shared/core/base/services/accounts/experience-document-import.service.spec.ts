import { ExperienceDocumentImportService } from './experience-document-import.service';

// Exercise document bytes/text at the parser boundary without a file-picker UI.
const parser = () => new ExperienceDocumentImportService() as unknown as {
  decodePdfLiteral(value: string): string;
  decodeXmlEntities(value: string): string;
  parsePdfToUnicodeMap(value: string): { glyphByCode: Map<string, string> };
  isSkippableParagraph(value: string[]): boolean;
};

describe('Experience document security boundaries', () => {
  it('decodes PDF escapes once, retaining escaped backslashes and octal results', () => {
    expect(parser().decodePdfLiteral(String.raw`a\nb`)).toBe('a\nb');
    expect(parser().decodePdfLiteral(String.raw`a\\nb`)).toBe('a\\nb');
    expect(parser().decodePdfLiteral(String.raw`a\\\\nb`)).toBe(String.raw`a\\nb`);
    expect(parser().decodePdfLiteral(String.raw`\134n`)).toBe(String.raw`\n`);
    expect(parser().decodePdfLiteral(String.raw`\101\102\050\051\\`)).toBe('AB()\\');
    expect(parser().decodePdfLiteral('a\\\r\nb')).toBe('ab');
  });

  it('decodes XML entities once without turning encoded entity text into markup', () => {
    expect(parser().decodeXmlEntities('&amp;lt;tag&amp;gt; &amp;#39;')).toBe('&lt;tag&gt; &#39;');
    expect(parser().decodeXmlEntities('&lt;tag&gt; &quot;x&quot; &#39;y&#39; &nbsp; &amp;')).toBe('<tag> "x" \'y\'   &');
  });

  it('reads consecutive and array-based Unicode mappings', () => {
    const map = parser().parsePdfToUnicodeMap('1 beginbfchar <01><0041> endbfchar 2 beginbfrange <02><03><0042> <04><05>[<0044> <0045>] endbfrange');
    expect([...map.glyphByCode.entries()]).toEqual([['01', 'A'], ['02', 'B'], ['03', 'C'], ['04', 'D'], ['05', 'E']]);
  });

  it('rejects malformed Unicode arrays without exponential backtracking', () => {
    const value = `1 beginbfrange <00><01>[${'<00> '.repeat(20_000)}endbfrange`;
    const started = performance.now();
    parser().parsePdfToUnicodeMap(value);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(parser().parsePdfToUnicodeMap('1 beginbfrange <00><01>[<0041> garbage <0042>] endbfrange').glyphByCode.size).toBe(0);
  });

  it.each(['github.com/member', 'https://github.com/member', 'https://www.github.com/member'])('recognizes the actual GitHub contact host: %s', value => {
    expect(parser().isSkippableParagraph([value])).toBe(true);
  });

  it.each(['https://github.com.evil.test/project', 'https://evil.test/?ref=github.com', 'https://evil.test/github.com/project'])('retains project text mentioning an unrelated host: %s', value => {
    expect(parser().isSkippableParagraph([value])).toBe(false);
  });
});
