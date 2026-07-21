import type { IdeaPostDto, IdeaPostPublicPageResultDto } from '../../../contracts/content.interface';

export interface LocalIdeaPostRecordPage {
  records: readonly IdeaPostDto[];
  total: number;
  nextCursor: string | null;
}

export class LocalIdeaPostsMapper {
  static toDto(record: IdeaPostDto): IdeaPostDto {
    return {
      ...record,
      imageUrls: [...(record.imageUrls ?? [])]
    };
  }

  static toDtoList(records: readonly IdeaPostDto[]): IdeaPostDto[] {
    return records.map(record => this.toDto(record));
  }

  static toDtoPage(page: LocalIdeaPostRecordPage): IdeaPostPublicPageResultDto {
    return {
      records: this.toDtoList(page.records),
      total: Math.max(0, Math.trunc(Number(page.total) || 0)),
      nextCursor: `${page.nextCursor ?? ''}`.trim() || null
    };
  }
}
