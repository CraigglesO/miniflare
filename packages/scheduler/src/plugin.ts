import {
  MiniflareError,
  Option,
  OptionType,
  Plugin,
  PluginContext,
} from "@d1testflare/shared";
import type { Cron } from "cron-schedule";

export type SchedulerErrorCode = "ERR_INVALID_CRON"; // Invalid CRON expression

export class SchedulerError extends MiniflareError<SchedulerErrorCode> {}

export interface SchedulerOptions {
  crons?: string[];
}

export class SchedulerPlugin
  extends Plugin<SchedulerOptions>
  implements SchedulerOptions
{
  @Option({
    type: OptionType.ARRAY,
    alias: "t",
    description: "CRON expression for triggering scheduled events",
    logName: "CRON Expressions",
    fromWrangler: ({ triggers }) => triggers?.crons,
  })
  crons?: string[];

  #validatedCrons: Cron[] = [];

  constructor(ctx: PluginContext, options?: SchedulerOptions) {
    super(ctx);
    this.assignOptions(options);
  }

  get validatedCrons(): Cron[] {
    return this.#validatedCrons;
  }

  async setup(): Promise<void> {
    if (!this.crons?.length) {
      this.#validatedCrons = [];
      return;
    }
    const {
      parseCronExpression,
    }: typeof import("cron-schedule") = require("cron-schedule");
    const validatedCrons = Array(this.crons.length);
    for (let i = 0; i < this.crons.length; i++) {
      const spec = this.crons[i];
      try {
        const cron = parseCronExpression(spec);
        cron.toString = () => spec;
        validatedCrons[i] = cron;
      } catch (e: any) {
        throw new SchedulerError(
          "ERR_INVALID_CRON",
          `Unable to parse CRON "${spec}": ${e.message}`
        );
      }
    }
    this.#validatedCrons = validatedCrons;
  }
}
