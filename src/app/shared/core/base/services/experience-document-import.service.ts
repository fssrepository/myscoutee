import { Injectable } from '@angular/core';

import type {
  ExperienceImportProgressCallback,
  ParsedExperienceImportEntry,
  UserExperienceImportParseResult
} from '../interfaces/experience.interface';
import type { ExperienceEntry } from '../models/profile.model';

type ExperienceSectionType = ExperienceEntry['type'] | 'Ignore';
type PdfFontMap = {
  glyphByCode: Map<string, string>;
  codeLengths: number[];
};

type PdfObjectStream = {
  objectId: number;
  dictionary: string;
  content: string;
};

type PdfObjectDefinition = {
  objectId: number;
  offset: number;
  nextOffset: number;
  source: string;
  dictionary: string;
};

@Injectable({
  providedIn: 'root'
})
export class ExperienceDocumentImportService {
  private static readonly SUPPORTED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt']);
  private static readonly MONTH_INDEX_BY_TOKEN: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };

  async parseFile(file: File, onProgress?: ExperienceImportProgressCallback): Promise<UserExperienceImportParseResult> {
    const extension = this.resolveExtension(file.name);
    if (!ExperienceDocumentImportService.SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error('Upload supports PDF, DOC, DOCX, ODT, RTF, and TXT files.');
    }

    const warnings: string[] = [];
    onProgress?.({
      stage: 'reading',
      percent: 8,
      label: 'Reading document'
    });
    const buffer = await file.arrayBuffer();
    let text = '';

    onProgress?.({
      stage: 'extracting',
      percent: 34,
      label: 'Extracting document text'
    });
    switch (extension) {
      case 'docx':
        text = await this.extractDocxText(buffer);
        break;
      case 'odt':
        text = await this.extractOdtText(buffer);
        break;
      case 'pdf':
        text = await this.extractPdfText(buffer);
        if (!text.trim()) {
          warnings.push('PDF extraction was low-confidence. Review the imported cards before saving further edits.');
        }
        break;
      case 'rtf':
        text = this.extractRtfText(buffer);
        break;
      case 'doc':
        text = this.extractLegacyDocText(buffer);
        warnings.push('Legacy DOC parsing is best-effort. Review the imported cards carefully.');
        break;
      default:
        text = this.decodeTextBuffer(buffer);
        break;
    }

    onProgress?.({
      stage: 'analyzing',
      percent: 72,
      label: 'Categorizing experience items'
    });
    const extracted = this.extractExperienceEntries(text, warnings);
    onProgress?.({
      stage: 'ready',
      percent: 100,
      label: extracted.entries.length > 0 ? 'Import preview ready' : 'No experience items recognized'
    });
    return {
      entries: extracted.entries,
      warnings: [...new Set(extracted.warnings)]
    };
  }

  private resolveExtension(fileName: string): string {
    const normalized = `${fileName ?? ''}`.trim().toLowerCase();
    const index = normalized.lastIndexOf('.');
    return index >= 0 ? normalized.slice(index + 1) : '';
  }

  private async extractDocxText(buffer: ArrayBuffer): Promise<string> {
    const xml = await this.extractZipEntryText(buffer, 'word/document.xml');
    return this.extractOfficeXmlText(xml, ['</w:p>', '</w:tr>', '<w:tab/>', '<w:br/>', '<w:cr/>']);
  }

  private async extractOdtText(buffer: ArrayBuffer): Promise<string> {
    const xml = await this.extractZipEntryText(buffer, 'content.xml');
    return this.extractOfficeXmlText(xml, ['</text:p>', '</text:h>', '<text:line-break/>', '<text:tab/>']);
  }

  private async extractZipEntryText(buffer: ArrayBuffer, entryName: string): Promise<string> {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const eocdOffset = this.findZipEndOfCentralDirectory(bytes);
    if (eocdOffset < 0) {
      throw new Error(`Unable to read ${entryName} from the uploaded archive.`);
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    let offset = centralDirectoryOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) {
        break;
      }
      const compressionMethod = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
      const fileName = this.decodeUtf8(fileNameBytes);

      if (fileName === entryName) {
        return this.readZipEntryText(bytes, view, localHeaderOffset, compressedSize, compressionMethod);
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }

    throw new Error(`The uploaded file does not contain ${entryName}.`);
  }

  private async readZipEntryText(
    bytes: Uint8Array,
    view: DataView,
    localHeaderOffset: number,
    compressedSize: number,
    compressionMethod: number
  ): Promise<string> {
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error('Unable to read the uploaded archive entry.');
    }
    const fileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const extraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
    const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize);

    if (compressionMethod === 0) {
      return this.decodeTextBuffer(compressedBytes.buffer.slice(
        compressedBytes.byteOffset,
        compressedBytes.byteOffset + compressedBytes.byteLength
      ));
    }
    if (compressionMethod === 8) {
      const inflated = await this.inflateBuffer(compressedBytes, 'deflate-raw');
      return this.decodeTextBuffer(inflated);
    }
    throw new Error('Unsupported compressed experience document entry.');
  }

  private findZipEndOfCentralDirectory(bytes: Uint8Array): number {
    for (let index = Math.max(0, bytes.length - 22); index >= Math.max(0, bytes.length - 65557); index -= 1) {
      if (
        bytes[index] === 0x50
        && bytes[index + 1] === 0x4b
        && bytes[index + 2] === 0x05
        && bytes[index + 3] === 0x06
      ) {
        return index;
      }
    }
    return -1;
  }

  private extractOfficeXmlText(xml: string, paragraphTokens: string[]): string {
    let normalized = xml;
    for (const token of paragraphTokens) {
      normalized = normalized.split(token).join(`${token}\n`);
    }
    return this.decodeXmlEntities(
      normalized
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
    );
  }

  private async extractPdfText(buffer: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(buffer);
    const raw = this.decodeBinaryBuffer(buffer);
    const streams = await this.extractPdfObjectStreams(raw, bytes);
    const fontMaps = this.extractPdfFontMaps(raw, streams);
    const textParts = streams.flatMap(stream => this.extractPdfTextFragments(stream.content, fontMaps));
    return [...new Set(textParts)]
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .join('\n');
  }

  private async inflatePdfStream(streamBytes: Uint8Array): Promise<ArrayBuffer | null> {
    const trimmedStreamBytes = this.trimPdfStreamPadding(streamBytes);
    for (const candidate of [streamBytes, trimmedStreamBytes]) {
      try {
        return await this.inflateBuffer(candidate, 'deflate');
      } catch {
        try {
          return await this.inflateBuffer(candidate, 'deflate-raw');
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private async extractPdfObjectStreams(raw: string, bytes: Uint8Array): Promise<PdfObjectStream[]> {
    const objects = this.extractPdfObjects(raw);
    if (objects.length > 0) {
      const streams: PdfObjectStream[] = [];

      for (const object of objects) {
        if (!object.dictionary || !object.source.includes('stream')) {
          continue;
        }

        const streamStart = this.resolvePdfStreamStart(object);
        if (streamStart < 0) {
          continue;
        }

        const declaredLength = this.resolvePdfStreamLength(object.dictionary, raw);
        const localEndStreamIndex = object.source.indexOf('endstream', streamStart - object.offset);
        const fallbackEnd = localEndStreamIndex >= 0 ? object.offset + localEndStreamIndex : -1;
        const end = declaredLength > 0 && streamStart + declaredLength <= object.nextOffset
          ? streamStart + declaredLength
          : fallbackEnd;
        if (end < 0 || end > bytes.length) {
          continue;
        }

        const streamBytes = bytes.slice(streamStart, end);
        let content = '';
        if (object.dictionary.includes('/FlateDecode')) {
          const inflated = await this.inflatePdfStream(streamBytes);
          if (!inflated) {
            continue;
          }
          content = this.decodeBinaryBuffer(inflated);
        } else {
          content = this.decodeBinaryBuffer(streamBytes.buffer.slice(
            streamBytes.byteOffset,
            streamBytes.byteOffset + streamBytes.byteLength
          ));
        }

        streams.push({
          objectId: object.objectId,
          dictionary: object.dictionary,
          content
        });
      }

      return streams;
    }

    const streams: PdfObjectStream[] = [];
    const streamPattern = /(?:^|[\r\n])(\d+)\s+0\s+obj\b\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
    let match: RegExpExecArray | null;

    while ((match = streamPattern.exec(raw)) !== null) {
      const objectId = Number.parseInt(match[1], 10);
      const dictionary = match[2];
      const start = streamPattern.lastIndex;
      const declaredLength = this.resolvePdfStreamLength(dictionary, raw);
      const fallbackEnd = raw.indexOf('endstream', start);
      const end = declaredLength > 0 && start + declaredLength <= bytes.length
        ? start + declaredLength
        : fallbackEnd;
      if (end < 0 || end > bytes.length) {
        streamPattern.lastIndex = fallbackEnd >= 0 ? fallbackEnd + 'endstream'.length : start + 1;
        continue;
      }

      const streamBytes = bytes.slice(start, end);
      const endStreamIndex = raw.indexOf('endstream', end);
      let content = '';
      if (dictionary.includes('/FlateDecode')) {
        const inflated = await this.inflatePdfStream(streamBytes);
        if (!inflated) {
          streamPattern.lastIndex = endStreamIndex >= 0 ? endStreamIndex + 'endstream'.length : end;
          continue;
        }
        content = this.decodeBinaryBuffer(inflated);
      } else {
        content = this.decodeBinaryBuffer(streamBytes.buffer.slice(
          streamBytes.byteOffset,
          streamBytes.byteOffset + streamBytes.byteLength
        ));
      }

      streams.push({
        objectId,
        dictionary,
        content
      });
      streamPattern.lastIndex = endStreamIndex >= 0 ? endStreamIndex + 'endstream'.length : end;
    }

    return streams;
  }

  private extractPdfTextFragments(stream: string, fontMaps: ReadonlyMap<string, PdfFontMap>): string[] {
    const fragments: string[] = [];
    const textSections = stream.match(/BT[\s\S]*?ET/g) ?? [];
    const operatorPattern = /\/(F\d+)\s+[\d.]+\s+Tf|(\[(?:.|\n)*?\]|<[\dA-Fa-f\s]+>|\((?:\\.|[^\\()])*\))\s*(TJ|Tj|['"])/g;

    for (const section of textSections) {
      let currentFont = '';
      let match: RegExpExecArray | null;

      while ((match = operatorPattern.exec(section)) !== null) {
        if (match[1]) {
          currentFont = match[1];
          continue;
        }
        const operand = match[2];
        if (!operand) {
          continue;
        }
        const decoded = this.decodePdfTextOperand(operand, currentFont, fontMaps);
        if (decoded.trim()) {
          fragments.push(decoded);
        }
      }
      operatorPattern.lastIndex = 0;
    }
    return fragments;
  }

  private extractPdfFontMaps(raw: string, streams: readonly PdfObjectStream[]): Map<string, PdfFontMap> {
    const streamByObjectId = new Map<number, string>(
      streams.map(stream => [stream.objectId, stream.content] as [number, string])
    );
    const dictionaryByObjectId = this.extractPdfObjectDictionaries(raw);
    const fontObjectByName = new Map<string, number>();

    for (const match of raw.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
      const fontName = match[1];
      if (!fontObjectByName.has(fontName)) {
        fontObjectByName.set(fontName, Number.parseInt(match[2], 10));
      }
    }

    const fontMaps = new Map<string, PdfFontMap>();
    for (const [fontName, fontObjectId] of fontObjectByName.entries()) {
      const dictionary = dictionaryByObjectId.get(fontObjectId) ?? '';
      const toUnicodeMatch = dictionary.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (!toUnicodeMatch) {
        continue;
      }
      const cmap = streamByObjectId.get(Number.parseInt(toUnicodeMatch[1], 10));
      if (!cmap) {
        continue;
      }
      const parsedMap = this.parsePdfToUnicodeMap(cmap);
      if (parsedMap.codeLengths.length > 0) {
        fontMaps.set(fontName, parsedMap);
      }
    }

    return fontMaps;
  }

  private extractPdfObjectDictionaries(raw: string): Map<number, string> {
    const objects = this.extractPdfObjects(raw);
    if (objects.length > 0) {
      return new Map(objects.map(object => [object.objectId, object.dictionary] as [number, string]));
    }

    const dictionaries = new Map<number, string>();
    for (const match of raw.matchAll(/(?:^|[\r\n])(\d+)\s+0\s+obj\b\s*<<([\s\S]*?)>>/g)) {
      const objectId = Number.parseInt(match[1], 10);
      if (!dictionaries.has(objectId)) {
        dictionaries.set(objectId, match[2]);
      }
    }
    return dictionaries;
  }

  private extractPdfObjects(raw: string): PdfObjectDefinition[] {
    const offsets = this.extractPdfObjectOffsets(raw);
    if (offsets.size === 0) {
      return [];
    }

    const orderedOffsets = [...offsets.entries()].sort((left, right) => left[1] - right[1]);
    const objects: PdfObjectDefinition[] = [];

    for (let index = 0; index < orderedOffsets.length; index += 1) {
      const [objectId, offset] = orderedOffsets[index];
      const nextOffset = orderedOffsets[index + 1]?.[1] ?? raw.length;
      if (offset < 0 || nextOffset <= offset || nextOffset > raw.length) {
        continue;
      }

      const source = raw.slice(offset, nextOffset);
      if (!/^\d+\s+\d+\s+obj\b/.test(source)) {
        continue;
      }

      const dictionaryMatch = source.match(/^\d+\s+\d+\s+obj\b\s*<<([\s\S]*?)>>/);
      objects.push({
        objectId,
        offset,
        nextOffset,
        source,
        dictionary: dictionaryMatch?.[1] ?? ''
      });
    }

    return objects;
  }

  private extractPdfObjectOffsets(raw: string): Map<number, number> {
    const startXrefMatches = [...raw.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
    const lastStartXrefMatch = startXrefMatches[startXrefMatches.length - 1];
    if (!lastStartXrefMatch) {
      return new Map();
    }

    let cursor = Number.parseInt(lastStartXrefMatch[1], 10);
    if (Number.isNaN(cursor) || raw.slice(cursor, cursor + 4) !== 'xref') {
      return new Map();
    }
    cursor += 4;

    const offsets = new Map<number, number>();
    while (cursor < raw.length) {
      const lineResult = this.readPdfLine(raw, cursor);
      if (!lineResult) {
        break;
      }
      cursor = lineResult.nextIndex;
      const line = lineResult.line.trim();
      if (!line) {
        continue;
      }
      if (line === 'trailer') {
        break;
      }

      const subsectionMatch = line.match(/^(\d+)\s+(\d+)$/);
      if (!subsectionMatch) {
        return new Map();
      }

      const objectStart = Number.parseInt(subsectionMatch[1], 10);
      const objectCount = Number.parseInt(subsectionMatch[2], 10);
      if (Number.isNaN(objectStart) || Number.isNaN(objectCount)) {
        return new Map();
      }

      for (let index = 0; index < objectCount; index += 1) {
        const entryLineResult = this.readPdfLine(raw, cursor);
        if (!entryLineResult) {
          return new Map();
        }
        cursor = entryLineResult.nextIndex;
        const entryMatch = entryLineResult.line.match(/^(\d{10})\s+(\d{5})\s+([nf])\s*$/);
        if (!entryMatch) {
          return new Map();
        }
        if (entryMatch[3] !== 'n') {
          continue;
        }
        offsets.set(objectStart + index, Number.parseInt(entryMatch[1], 10));
      }
    }

    return offsets;
  }

  private readPdfLine(raw: string, startIndex: number): { line: string; nextIndex: number } | null {
    if (startIndex >= raw.length) {
      return null;
    }

    let endIndex = startIndex;
    while (endIndex < raw.length && raw[endIndex] !== '\n' && raw[endIndex] !== '\r') {
      endIndex += 1;
    }

    let nextIndex = endIndex;
    if (raw[nextIndex] === '\r' && raw[nextIndex + 1] === '\n') {
      nextIndex += 2;
    } else if (nextIndex < raw.length) {
      nextIndex += 1;
    }

    return {
      line: raw.slice(startIndex, endIndex),
      nextIndex
    };
  }

  private resolvePdfStreamStart(object: PdfObjectDefinition): number {
    const streamKeywordIndex = object.source.indexOf('stream');
    if (streamKeywordIndex < 0) {
      return -1;
    }

    let startIndex = streamKeywordIndex + 'stream'.length;
    if (object.source[startIndex] === '\r' && object.source[startIndex + 1] === '\n') {
      startIndex += 2;
    } else if (object.source[startIndex] === '\n' || object.source[startIndex] === '\r') {
      startIndex += 1;
    }

    return object.offset + startIndex;
  }

  private parsePdfToUnicodeMap(cmap: string): PdfFontMap {
    const glyphByCode = new Map<string, string>();

    for (const block of cmap.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        glyphByCode.set(pair[1].toUpperCase(), this.decodePdfUnicodeHex(pair[2]));
      }
    }

    for (const block of cmap.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const range of block[1].matchAll(
        /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[((?:\s*<[\dA-Fa-f]+>\s*)+)\])/g
      )) {
        const startCode = Number.parseInt(range[1], 16);
        const endCode = Number.parseInt(range[2], 16);
        const codeLength = range[1].length;
        if (Number.isNaN(startCode) || Number.isNaN(endCode) || endCode < startCode) {
          continue;
        }

        if (range[4]) {
          const unicodeStart = Number.parseInt(range[4], 16);
          if (Number.isNaN(unicodeStart)) {
            continue;
          }
          for (let offset = 0; offset <= endCode - startCode; offset += 1) {
            glyphByCode.set(
              (startCode + offset).toString(16).toUpperCase().padStart(codeLength, '0'),
              this.decodePdfUnicodeHex((unicodeStart + offset).toString(16).toUpperCase().padStart(range[4].length, '0'))
            );
          }
          continue;
        }

        const destinations = [...(range[5] ?? '').matchAll(/<([\dA-Fa-f]+)>/g)].map(match => match[1]);
        for (let offset = 0; offset < destinations.length && startCode + offset <= endCode; offset += 1) {
          glyphByCode.set(
            (startCode + offset).toString(16).toUpperCase().padStart(codeLength, '0'),
            this.decodePdfUnicodeHex(destinations[offset])
          );
        }
      }
    }

    return {
      glyphByCode,
      codeLengths: [...new Set([...glyphByCode.keys()].map(code => code.length))].sort((left, right) => right - left)
    };
  }

  private decodePdfTextOperand(
    operand: string,
    fontName: string,
    fontMaps: ReadonlyMap<string, PdfFontMap>
  ): string {
    if (operand.startsWith('[')) {
      return this.decodePdfTextArray(operand, fontName, fontMaps);
    }
    return this.decodePdfTextToken(operand, fontName, fontMaps).trim();
  }

  private decodePdfTextArray(
    operand: string,
    fontName: string,
    fontMaps: ReadonlyMap<string, PdfFontMap>
  ): string {
    const tokens = operand.match(/\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]+>|-?\d+(?:\.\d+)?/g) ?? [];
    let decoded = '';

    for (const token of tokens) {
      if (token.startsWith('(') || token.startsWith('<')) {
        decoded += this.decodePdfTextToken(token, fontName, fontMaps);
      }
    }

    return decoded.replace(/\s{2,}/g, ' ').trim();
  }

  private decodePdfTextToken(
    token: string,
    fontName: string,
    fontMaps: ReadonlyMap<string, PdfFontMap>
  ): string {
    if (token.startsWith('(') && token.endsWith(')')) {
      return this.decodePdfLiteral(token.slice(1, -1));
    }
    if (token.startsWith('<') && token.endsWith('>')) {
      return this.decodePdfHexString(token.slice(1, -1), fontName, fontMaps);
    }
    return '';
  }

  private decodePdfHexString(
    value: string,
    fontName: string,
    fontMaps: ReadonlyMap<string, PdfFontMap>
  ): string {
    const normalized = value.replace(/\s+/g, '').toUpperCase();
    if (!normalized) {
      return '';
    }

    const fontMap = fontMaps.get(fontName);
    if (!fontMap || fontMap.codeLengths.length === 0) {
      return this.decodePdfUnicodeHex(normalized);
    }

    let cursor = 0;
    let decoded = '';
    const fallbackLength = fontMap.codeLengths[fontMap.codeLengths.length - 1] ?? 2;

    while (cursor < normalized.length) {
      let matched = false;
      for (const codeLength of fontMap.codeLengths) {
        const code = normalized.slice(cursor, cursor + codeLength);
        if (code.length < codeLength) {
          continue;
        }
        const mapped = fontMap.glyphByCode.get(code);
        if (mapped === undefined) {
          continue;
        }
        decoded += mapped;
        cursor += codeLength;
        matched = true;
        break;
      }

      if (matched) {
        continue;
      }

      const nextCursor = Math.min(cursor + fallbackLength, normalized.length);
      decoded += this.decodePdfUnicodeHex(normalized.slice(cursor, nextCursor));
      cursor = nextCursor;
    }

    return decoded;
  }

  private decodePdfUnicodeHex(value: string): string {
    const normalized = value.replace(/\s+/g, '').toUpperCase();
    if (!normalized) {
      return '';
    }

    if (normalized.length % 4 === 0) {
      let decoded = '';
      for (let index = 0; index < normalized.length; index += 4) {
        const codePoint = Number.parseInt(normalized.slice(index, index + 4), 16);
        if (Number.isNaN(codePoint)) {
          return '';
        }
        decoded += codePoint === 0xF0B7 ? '•' : String.fromCodePoint(codePoint);
      }
      if (decoded.trim()) {
        return decoded;
      }
    }

    let decoded = '';
    for (let index = 0; index + 1 < normalized.length; index += 2) {
      const code = Number.parseInt(normalized.slice(index, index + 2), 16);
      if (!Number.isNaN(code)) {
        decoded += String.fromCharCode(code);
      }
    }
    return decoded;
  }

  private decodePdfLiteral(value: string): string {
    let normalized = value
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t');
    normalized = normalized.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
    return normalized;
  }

  private extractRtfText(buffer: ArrayBuffer): string {
    return this.decodeTextBuffer(buffer)
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\tab/g, '\t')
      .replace(/\\'[0-9a-fA-F]{2}/g, '')
      .replace(/\\[a-z]+-?\d* ?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  private extractLegacyDocText(buffer: ArrayBuffer): string {
    return this.decodeTextBuffer(buffer, 'windows-1252')
      .replace(/\u0000/g, '')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u017F]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }

  private decodeTextBuffer(buffer: ArrayBuffer, encoding = 'utf-8'): string {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }

  private decodeBinaryBuffer(buffer: ArrayBuffer): string {
    return new TextDecoder('latin1').decode(buffer);
  }

  private trimPdfStreamPadding(streamBytes: Uint8Array): Uint8Array {
    let end = streamBytes.length;
    while (end > 0) {
      const byte = streamBytes[end - 1];
      if (byte !== 0x0A && byte !== 0x0D) {
        break;
      }
      end -= 1;
    }
    return end === streamBytes.length ? streamBytes : streamBytes.slice(0, end);
  }

  private resolvePdfStreamLength(dictionary: string, raw: string): number {
    const directLengthMatch = dictionary.match(/\/Length\s+(\d+)\b(?!\s+0\s+R)/);
    if (directLengthMatch) {
      return Number.parseInt(directLengthMatch[1], 10);
    }

    const indirectLengthMatch = dictionary.match(/\/Length\s+(\d+)\s+0\s+R/);
    if (!indirectLengthMatch) {
      return -1;
    }

    const objectMatch = raw.match(new RegExp(`(?:^|[\\r\\n])${indirectLengthMatch[1]}\\s+0\\s+obj\\b\\s+(\\d+)\\s+endobj`, 'm'));
    if (!objectMatch) {
      return -1;
    }

    return Number.parseInt(objectMatch[1], 10);
  }

  private decodeUtf8(bytes: Uint8Array): string {
    return new TextDecoder('utf-8').decode(bytes);
  }

  private async inflateBuffer(bytes: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<ArrayBuffer> {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Compressed document import is unavailable in this browser.');
    }
    const payload = Uint8Array.from(bytes);
    const source = new ReadableStream<BufferSource>({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      }
    });
    const decompressor = new DecompressionStream(format) as unknown as TransformStream<BufferSource, Uint8Array>;
    const stream = source.pipeThrough(decompressor);
    return new Response(stream).arrayBuffer();
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/&nbsp;/g, ' ');
  }

  private extractExperienceEntries(text: string, seedWarnings: readonly string[]): UserExperienceImportParseResult {
    const warnings = [...seedWarnings];
    const normalizedText = this.normalizeExtractedText(text);
    if (!normalizedText) {
      return {
        entries: [],
        warnings: ['The selected file did not contain readable resume text.']
      };
    }

    const paragraphs = normalizedText
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(block => block.length > 0);

    const entries: ParsedExperienceImportEntry[] = [];
    const seenSignatures = new Set<string>();
    let currentSection: ExperienceSectionType = 'Workspace';
    let usedFallbackDate = false;

    for (const paragraph of paragraphs) {
      const lines = paragraph
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      if (lines.length === 0) {
        continue;
      }
      if (this.isSkippableParagraph(lines)) {
        continue;
      }

      let currentLines = lines;
      const leadingHeaderType = this.resolveSectionHeaderType(lines[0] ?? '');
      if (leadingHeaderType) {
        currentSection = leadingHeaderType;
        currentLines = lines.slice(1).filter(line => line.length > 0);
        if (currentLines.length === 0 || currentSection === 'Ignore') {
          continue;
        }
      }

      const headerType = this.resolveSectionHeaderType(currentLines.join(' '));
      if (headerType && this.isSectionHeaderParagraph(lines)) {
        currentSection = headerType;
        continue;
      }
      if (currentSection === 'Ignore') {
        continue;
      }

      if (currentSection !== 'Workspace' && this.isStandaloneDateRangeLine(currentLines[0] ?? '')) {
        currentSection = 'Workspace';
        continue;
      }

      if (currentSection === 'Workspace') {
        continue;
      }

      if (currentLines.length === 1) {
        continue;
      }

      const parsedBlock = this.parseSectionBlock(
        currentLines,
        currentSection as Extract<ExperienceSectionType, 'School' | 'Online Session' | 'Additional Project'>
      );
      if (!parsedBlock) {
        continue;
      }

      const signature = this.entrySignature(parsedBlock);
      if (seenSignatures.has(signature)) {
        continue;
      }
      seenSignatures.add(signature);
      entries.push(parsedBlock);
    }

    if (usedFallbackDate) {
      warnings.push('Some imported cards did not have a clear date range, so a fallback date was assigned. Review the orange cards.');
    }
    const fallbackEntries = this.extractTimelineFallbackEntries(normalizedText, seenSignatures);
    entries.push(...fallbackEntries);
    if (entries.length === 0) {
      warnings.push('No structured experience items were recognized from the uploaded file.');
    }

    return {
      entries,
      warnings
    };
  }

  private normalizeExtractedText(value: string): string {
    return value
      .replace(/\r/g, '\n')
      .replace(/\u0000+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[•▪◦●■]/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private isSkippableParagraph(lines: readonly string[]): boolean {
    const joined = lines.join(' ').toLowerCase();
    if (lines.length === 1 && joined.length <= 2) {
      return true;
    }
    return joined.includes('@')
      || joined.includes('linkedin')
      || joined.includes('github.com')
      || joined.includes('phone')
      || joined.includes('email')
      || joined.includes('references')
      || joined.includes('skills')
      || joined.includes('languages');
  }

  private resolveSectionHeaderType(value: string): ExperienceSectionType | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (/^(work experience|professional experience|employment|career history|work history|experience)$/.test(normalized)) {
      return 'Workspace';
    }
    if (/^(education|academic background|studies)$/.test(normalized)) {
      return 'School';
    }
    if (/^(thesis|dissertation)$/.test(normalized)) {
      return 'Additional Project';
    }
    if (/^(projects?|portfolio|open source|freelance projects?)$/.test(normalized)) {
      return 'Additional Project';
    }
    if (/^(certifications?|courses?|training|bootcamps?|online courses?|certificates?|interests)$/.test(normalized)) {
      return 'Online Session';
    }
    if (/^(summary|profile|skills|technology|technical skills|tech stack|languages|contact|personal data|personal details)$/.test(normalized)) {
      return 'Ignore';
    }
    return null;
  }

  private isSectionHeaderParagraph(lines: readonly string[]): boolean {
    return lines.length <= 2
      && lines.join(' ').length <= 64
      && !this.containsDateRange(lines.join(' '));
  }

  private resolveEntryType(lines: readonly string[], sectionType: ExperienceSectionType): ExperienceEntry['type'] {
    const normalized = lines.join(' ').toLowerCase();
    if (sectionType === 'School' || sectionType === 'Online Session' || sectionType === 'Additional Project') {
      return sectionType;
    }
    if (/(university|college|academy|school|bsc|msc|phd|degree|diploma)/.test(normalized)) {
      return 'School';
    }
    if (/(course|certification|certificate|bootcamp|online|remote program|udemy|coursera|edx)/.test(normalized)) {
      return 'Online Session';
    }
    if (/(portfolio|open source|independent project|side project|personal project|pet project)/.test(normalized)) {
      return 'Additional Project';
    }
    return 'Workspace';
  }

  private parseExperienceBlock(
    lines: readonly string[],
    type: ExperienceEntry['type']
  ): { entry: ParsedExperienceImportEntry; usedFallbackDate: boolean } | null {
    const dateRange = this.extractDateRange(lines.join(' '));
    const title = this.resolveTitle(lines);
    if (!title) {
      return null;
    }

    const metaLine = this.resolveMetaLine(lines, title, dateRange?.matchedText ?? '');
    const parsedMeta = this.parseMetaLine(metaLine, type);
    const fallbackDate = this.currentYearMonth();
    const dateFrom = dateRange?.dateFrom ?? fallbackDate;
    const dateTo = dateRange?.dateTo ?? 'Present';
    const description = this.resolveDescription(lines, title, metaLine, dateRange?.matchedText ?? '');

    return {
      entry: {
        type,
        title,
        org: parsedMeta.org,
        city: parsedMeta.city,
        dateFrom,
        dateTo,
        description
      },
      usedFallbackDate: !dateRange
    };
  }

  private resolveTitle(lines: readonly string[]): string {
    return lines.find(line => line.length > 2 && !this.looksLikeContactLine(line)) ?? '';
  }

  private resolveMetaLine(lines: readonly string[], title: string, matchedDateText: string): string {
    for (const line of lines) {
      if (line === title) {
        continue;
      }
      const cleaned = matchedDateText ? line.replace(matchedDateText, ' ') : line;
      if (cleaned.trim().length > 0) {
        return cleaned.trim();
      }
    }
    return '';
  }

  private parseMetaLine(line: string, type: ExperienceEntry['type']): { org: string; city: string } {
    const fallbackOrg = type === 'School'
      ? 'Academic Program'
      : type === 'Online Session'
        ? 'Online Program'
        : type === 'Additional Project'
          ? 'Independent Project'
          : 'Professional Experience';
    if (!line) {
      return {
        org: fallbackOrg,
        city: ''
      };
    }

    const compact = line
      .replace(/\s+[–-]\s+/g, ' · ')
      .replace(/\s+\|\s+/g, ' · ');
    const segments = compact
      .split(/·|,/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    if (segments.length === 0) {
      return {
        org: fallbackOrg,
        city: ''
      };
    }
    if (segments.length === 1) {
      return {
        org: segments[0],
        city: ''
      };
    }
    return {
      org: segments[0] || fallbackOrg,
      city: segments[segments.length - 1] || ''
    };
  }

  private resolveDescription(
    lines: readonly string[],
    title: string,
    metaLine: string,
    matchedDateText: string
  ): string {
    const ignored = new Set([title, metaLine, matchedDateText].filter(item => item.length > 0));
    const descriptionLines = lines
      .map(line => matchedDateText ? line.replace(matchedDateText, ' ').trim() : line.trim())
      .filter(line => line.length > 0 && !ignored.has(line));
    return descriptionLines.join(' ').slice(0, 280);
  }

  private extractTimelineFallbackEntries(
    normalizedText: string,
    seenSignatures: Set<string>
  ): ParsedExperienceImportEntry[] {
    const lines = normalizedText
      .split('\n')
      .map(line => this.cleanTimelineLine(line))
      .filter(line => line.length > 0);

    const entries: ParsedExperienceImportEntry[] = [];
    let currentSection: ExperienceSectionType = 'Workspace';

    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      const headerType = this.resolveSectionHeaderType(line);
      if (headerType && this.isSectionHeaderParagraph([line])) {
        currentSection = headerType;
        index += 1;
        continue;
      }

      if (currentSection !== 'Workspace' && this.isStandaloneDateRangeLine(line)) {
        currentSection = 'Workspace';
      }

      if (currentSection === 'School' || currentSection === 'Additional Project' || currentSection === 'Online Session') {
        const collected = this.collectTimelineBlock(lines, index, currentSection);
        const parsed = this.parseSectionBlock(collected.blockLines, currentSection);
        if (parsed) {
          const signature = this.entrySignature(parsed);
          if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            entries.push(parsed);
          }
        }
        index = collected.nextIndex;
        continue;
      }

      if (this.containsDateRange(line)) {
        const collected = this.collectTimelineBlock(lines, index, 'Workspace');
        const parsed = this.parseTimelineBlock(collected.blockLines, currentSection);
        if (parsed) {
          const signature = this.entrySignature(parsed);
          if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            entries.push(parsed);
          }
        }
        index = collected.nextIndex;
        continue;
      }

      index += 1;
    }

    return entries;
  }

  private collectTimelineBlock(
    lines: readonly string[],
    startIndex: number,
    currentSection: ExperienceSectionType
  ): { blockLines: string[]; nextIndex: number } {
    const blockLines: string[] = [];
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      if (
        blockLines.length > 0
        && (
          (currentSection === 'Workspace' ? this.containsDateRange(line) : this.isStandaloneDateRangeLine(line))
          || Boolean(this.resolveSectionHeaderType(line) && this.isSectionHeaderParagraph([line]))
        )
      ) {
        break;
      }
      if (this.isStandaloneNoiseLine(line)) {
        index += 1;
        continue;
      }
      blockLines.push(line);
      index += 1;
    }

    return {
      blockLines,
      nextIndex: index
    };
  }

  private parseTimelineBlock(
    lines: readonly string[],
    currentSection: ExperienceSectionType
  ): ParsedExperienceImportEntry | null {
    if (lines.length < 2) {
      return null;
    }

    const dateRange = this.extractDateRange(lines[0]);
    if (!dateRange) {
      return null;
    }

    const remainder = lines.slice(1).filter(line => line.length > 0);
    if (remainder.length === 0) {
      return null;
    }

    const org = remainder[0];
    let cursor = 1;
    let city = '';

    if (cursor < remainder.length && this.looksLikeLocationLine(remainder[cursor])) {
      city = remainder[cursor];
      cursor += 1;
      if (cursor < remainder.length && this.looksLikeLocationContinuationLine(remainder[cursor])) {
        city = `${city} ${remainder[cursor]}`.trim();
        cursor += 1;
      }
    }

    const titleLines: string[] = [];
    while (cursor < remainder.length && titleLines.length < 2 && this.looksLikeRoleLine(remainder[cursor])) {
      titleLines.push(remainder[cursor]);
      cursor += 1;
    }

    if (titleLines.length === 0 && cursor < remainder.length && !this.looksLikeTechnologyLine(remainder[cursor])) {
      titleLines.push(remainder[cursor]);
      cursor += 1;
    }

    const technologyLines: string[] = [];
    while (cursor < remainder.length && this.looksLikeTechnologyLine(remainder[cursor])) {
      technologyLines.push(remainder[cursor]);
      cursor += 1;
    }

    if (!city && cursor < remainder.length && this.looksLikeLocationLine(remainder[cursor])) {
      city = remainder[cursor];
      cursor += 1;
      if (cursor < remainder.length && this.looksLikeLocationContinuationLine(remainder[cursor])) {
        city = `${city} ${remainder[cursor]}`.trim();
        cursor += 1;
      }
    }

    const descriptionLines = remainder
      .slice(cursor)
      .filter(line => !this.looksLikeLocationLine(line));
    const description = [...technologyLines, ...descriptionLines].join(' ').slice(0, 280);
    const title = titleLines.join(' / ').trim() || org;
    const type = this.resolveEntryType(
      [title, org, ...technologyLines, ...descriptionLines],
      currentSection === 'School' || currentSection === 'Online Session' || currentSection === 'Additional Project'
        ? currentSection
        : 'Workspace'
    );

    return {
      type,
      title,
      org,
      city,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      description
    };
  }

  private parseSectionBlock(
    lines: readonly string[],
    type: Extract<ExperienceSectionType, 'School' | 'Online Session' | 'Additional Project'>
  ): ParsedExperienceImportEntry | null {
    const cleaned = lines.filter(line => line.length > 0 && !this.isStandaloneNoiseLine(line));
    if (cleaned.length === 0) {
      return null;
    }

    let title = cleaned[0];
    let cursor = 1;
    if (/^(thesis|dissertation)$/i.test(title) && cleaned.length > 1) {
      title = cleaned[1];
      cursor = 2;
    }
    if (cursor < cleaned.length && this.shouldMergeWrappedHeading(title, cleaned[cursor])) {
      title = `${title} ${cleaned[cursor]}`.replace(/\s+/g, ' ').trim();
      cursor += 1;
    }

    if (!title || this.resolveSectionHeaderType(title) === 'Ignore') {
      return null;
    }

    const combined = cleaned.join(' ');
    const dateRange = this.extractDateRange(combined);
    const resolvedDate = dateRange
      ? {
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo
      }
      : (() => {
        const standaloneDate = this.extractStandaloneDateToken(combined);
        return standaloneDate
          ? {
            dateFrom: standaloneDate,
            dateTo: standaloneDate
          }
          : null;
      })();
    const orgLines = cleaned
      .slice(cursor)
      .filter(line => !this.looksLikeTechnologyLine(line) && !this.looksLikeLocationLine(line));
    const city = cleaned.slice(cursor).find(line => this.looksLikeLocationLine(line)) ?? '';
    const description = cleaned.slice(cursor).join(' ').slice(0, 280);

    return {
      type,
      title,
      org: orgLines.slice(0, 2).join(' / ') || this.fallbackOrganization(type),
      city,
      dateFrom: resolvedDate?.dateFrom ?? this.currentYearMonth(),
      dateTo: resolvedDate?.dateTo ?? 'Present',
      description
    };
  }

  private cleanTimelineLine(line: string): string {
    return line
      .replace(/^[•▪◦●■]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isStandaloneNoiseLine(line: string): boolean {
    return !line
      || /^[(]?[•▪◦●■\s]+[)]?$/.test(line)
      || /^(page \d+|\f)$/i.test(line);
  }

  private looksLikeTechnologyLine(line: string): boolean {
    const normalized = line.toLowerCase();
    return /(java|kotlin|spring|hibernate|javascript|typescript|angular|react|vue|docker|kubernetes|openshift|maven|gradle|rabbitmq|kafka|mongo|mysql|oracle|redis|firebase|google cloud|aws|php|smarty|pl\/sql|sql|jsp|jsf|jboss|tomcat|weblogic|soap|soa|selenium|netty|jquery|gitlab|jenkins|micro-?services|mqtt|protobuf|webrtc|ionic|capacitor|blender|linux|devops)/.test(normalized)
      || ((line.match(/,/g) ?? []).length >= 2 && normalized.length <= 160);
  }

  private looksLikeRoleLine(line: string): boolean {
    const normalized = line.toLowerCase();
    return /(developer|engineer|architect|manager|founder|consultant|programmer|lead|director|owner|specialist|analyst|designer|freelancer)/.test(normalized);
  }

  private looksLikeLocationLine(line: string): boolean {
    const normalized = line.toLowerCase();
    if (!line || line.length > 48 || /[0-9@]/.test(line) || line.includes('.')) {
      return false;
    }
    if (/(university|college|school|academy|faculty|institute|department|campus)/.test(normalized)) {
      return false;
    }
    if (this.looksLikeTechnologyLine(line) || this.looksLikeRoleLine(line)) {
      return false;
    }
    return /^[A-Za-zÀ-ž()\/,&\s-]+$/.test(line)
      && (normalized.includes(' from ') || normalized.includes('/') || line.split(/\s+/).length <= 4);
  }

  private looksLikeLocationContinuationLine(line: string): boolean {
    return /^\([^)]{1,48}\)$/.test(line.trim());
  }

  private shouldMergeWrappedHeading(current: string, next: string): boolean {
    if (!next) {
      return false;
    }
    const normalizedCurrent = current.trim().toLowerCase();
    const continuesCurrent = /(in|of|for|and|to|with|on)$/.test(normalizedCurrent);
    if (
      this.resolveSectionHeaderType(next) !== null
      || this.looksLikeTechnologyLine(next)
      || this.looksLikeLocationLine(next)
      || this.looksLikeRoleLine(next)
      || (this.containsDateRange(next) && !continuesCurrent)
    ) {
      return false;
    }

    return continuesCurrent
      || (current.trim().length <= 36 && /^[A-ZÀ-Ž(]/.test(next.trim()));
  }

  private fallbackOrganization(type: ExperienceEntry['type']): string {
    if (type === 'School') {
      return 'Academic Program';
    }
    if (type === 'Online Session') {
      return 'Online Program';
    }
    if (type === 'Additional Project') {
      return 'Independent Project';
    }
    return 'Professional Experience';
  }

  private extractDateRange(value: string): { dateFrom: string; dateTo: string; matchedText: string } | null {
    const patterns = [
      /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}|\d{4}[/-]\d{1,2}|\d{4})\s*(?:-|–|to)\s*(present|current|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}|\d{4}[/-]\d{1,2}|\d{4})/i,
      /((?:\d{1,2}[/-]\d{4}))\s*(?:-|–|to)\s*(present|current|now|(?:\d{1,2}[/-]\d{4}))/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (!match) {
        continue;
      }
      const dateFrom = this.normalizeDateToken(match[1]);
      const dateTo = this.normalizeDateToken(match[2]);
      if (!dateFrom) {
        continue;
      }
      return {
        dateFrom,
        dateTo: dateTo || 'Present',
        matchedText: match[0]
      };
    }

    return null;
  }

  private containsDateRange(value: string): boolean {
    return this.extractDateRange(value) !== null;
  }

  private isStandaloneDateRangeLine(value: string): boolean {
    const dateRange = this.extractDateRange(value);
    if (!dateRange) {
      return false;
    }
    return value.replace(dateRange.matchedText, ' ').trim().length === 0;
  }

  private extractStandaloneDateToken(value: string): string {
    const match = value.match(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}|\d{4}[/-]\d{1,2}|\d{4})\b/i);
    return match ? this.normalizeDateToken(match[1]) : '';
  }

  private normalizeDateToken(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'present' || normalized === 'current' || normalized === 'now') {
      return 'Present';
    }

    const slashMatch = normalized.match(/^(\d{1,2})[/-](\d{4})$/);
    if (slashMatch) {
      const month = Number.parseInt(slashMatch[1], 10);
      const year = Number.parseInt(slashMatch[2], 10);
      return month >= 1 && month <= 12 ? `${year}-${`${month}`.padStart(2, '0')}` : `${year}-01`;
    }

    const yearMonthMatch = normalized.match(/^(\d{4})[/-](\d{1,2})$/);
    if (yearMonthMatch) {
      const year = Number.parseInt(yearMonthMatch[1], 10);
      const month = Number.parseInt(yearMonthMatch[2], 10);
      return month >= 1 && month <= 12 ? `${year}-${`${month}`.padStart(2, '0')}` : `${year}-01`;
    }

    const monthWordMatch = normalized.match(/^([a-z]+)\s+(\d{4})$/);
    if (monthWordMatch) {
      const monthIndex = ExperienceDocumentImportService.MONTH_INDEX_BY_TOKEN[monthWordMatch[1]];
      const year = Number.parseInt(monthWordMatch[2], 10);
      if (monthIndex) {
        return `${year}-${`${monthIndex}`.padStart(2, '0')}`;
      }
    }

    const yearMatch = normalized.match(/^(\d{4})$/);
    if (yearMatch) {
      return `${yearMatch[1]}-01`;
    }

    return '';
  }

  private currentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
  }

  private entrySignature(entry: ParsedExperienceImportEntry): string {
    return [
      entry.type,
      entry.title.trim().toLowerCase(),
      entry.org.trim().toLowerCase(),
      entry.dateFrom.trim(),
      entry.dateTo.trim()
    ].join('|');
  }

  private looksLikeContactLine(line: string): boolean {
    const normalized = line.toLowerCase();
    return normalized.includes('@') || normalized.includes('linkedin') || normalized.includes('github');
  }
}
