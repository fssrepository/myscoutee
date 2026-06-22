export type ConverterOptionsArg<TOptions> = undefined extends TOptions
  ? [options?: TOptions]
  : [options: TOptions];

export interface UiConverter<TInput, TOutput, TOptions = undefined> {
  convert(input: TInput, ...options: ConverterOptionsArg<TOptions>): TOutput;
}

export interface UiListConverter<TInput, TOutput, TOptions = undefined>
  extends UiConverter<TInput, TOutput, TOptions> {
  convertList(input: readonly TInput[], ...options: ConverterOptionsArg<TOptions>): TOutput[];
}
