import {
  Context,
  Option,
  OptionType,
  Plugin,
  PluginContext,
  SetupResult,
  StorageFactory,
  resolveStoragePersist,
} from "@d1testflare/shared";
import { KVNamespace } from "./namespace";

export interface KVOptions {
  kvNamespaces?: string[];
  kvPersist?: boolean | string;
}

export class KVPlugin extends Plugin<KVOptions> implements KVOptions {
  @Option({
    type: OptionType.ARRAY,
    name: "kv",
    alias: "k",
    description: "KV namespace to bind",
    logName: "KV Namespaces",
    fromWrangler: ({ kv_namespaces }) =>
      kv_namespaces?.map(({ binding }) => binding),
  })
  kvNamespaces?: string[];

  @Option({
    type: OptionType.BOOLEAN_STRING,
    description: "Persist KV data (to optional path)",
    logName: "KV Persistence",
    fromWrangler: ({ miniflare }) => miniflare?.kv_persist,
  })
  kvPersist?: boolean | string;
  readonly #persist?: boolean | string;

  constructor(ctx: PluginContext, options?: KVOptions) {
    super(ctx);
    this.assignOptions(options);
    this.#persist = resolveStoragePersist(ctx.rootPath, this.kvPersist);
  }

  async getNamespace(
    storage: StorageFactory,
    namespace: string,
    blockGlobalAsyncIO = false
  ): Promise<KVNamespace> {
    return new KVNamespace(await storage.storage(namespace, this.#persist), {
      blockGlobalAsyncIO,
    });
  }

  async setup(storageFactory: StorageFactory): Promise<SetupResult> {
    const blockGlobalAsyncIO = !this.ctx.globalAsyncIO;
    const bindings: Context = {};
    for (const namespace of this.kvNamespaces ?? []) {
      bindings[namespace] = await this.getNamespace(
        storageFactory,
        namespace,
        blockGlobalAsyncIO
      );
    }
    return { bindings };
  }
}
