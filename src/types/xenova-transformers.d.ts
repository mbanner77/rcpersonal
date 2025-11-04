interface PipelineOutput {
  generated_text?: string;
  [key: string]: unknown;
}

type PipelineHandler = (input: string, options?: Record<string, unknown>) => Promise<PipelineOutput[] | PipelineOutput>;

declare module "@xenova/transformers" {
  export function pipeline(
    task: "text-generation" | string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<PipelineHandler>;
}
