export interface RecordToDtoMapper<TRecord, TDto> {
  toDto(record: TRecord): TDto;
}

export interface RecordToDtoListMapper<TRecord, TDto> extends RecordToDtoMapper<TRecord, TDto> {
  toDtoList(records: readonly TRecord[]): TDto[];
}

export interface NullableRecordToDtoMapper<TRecord, TDto> {
  toDto(record: TRecord): TDto | null;
}

export interface DtoToRecordMapper<TDto, TRecord> {
  toRecord(dto: TDto): TRecord;
}

export interface DtoToRecordListMapper<TDto, TRecord> extends DtoToRecordMapper<TDto, TRecord> {
  toRecordList(dtos: readonly TDto[]): TRecord[];
}

export interface ContextualDtoToRecordMapper<TContext, TDto, TRecord> {
  toRecord(context: TContext, dto: TDto): TRecord;
}

export interface DtoRecordMapper<TRecord, TDto>
  extends RecordToDtoListMapper<TRecord, TDto>,
    DtoToRecordListMapper<TDto, TRecord> {}

export type DtoMapper<TRecord, TDto> = RecordToDtoMapper<TRecord, TDto>;
export type DtoListMapper<TRecord, TDto> = RecordToDtoListMapper<TRecord, TDto>;
