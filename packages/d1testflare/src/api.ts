import http from "http";
import https from "https";
import { CachePlugin, CacheStorage } from "@d1testflare/cache";
import {
  BindingsPlugin,
  BuildPlugin,
  CorePlugin,
  MiniflareCore,
  MiniflareCoreOptions,
} from "@d1testflare/core";
import { D1Database, D1Plugin } from "@d1testflare/d1";
import {
  DurableObjectId,
  DurableObjectNamespace,
  DurableObjectStorage,
  DurableObjectsPlugin,
} from "@d1testflare/durable-objects";
import { HTMLRewriterPlugin } from "@d1testflare/html-rewriter";
import {
  DEFAULT_PORT,
  HTTPPlugin,
  createServer,
  startServer,
} from "@d1testflare/http-server";
import { KVNamespace, KVPlugin } from "@d1testflare/kv";
import { R2Bucket, R2Plugin } from "@d1testflare/r2";
import { VMScriptRunner } from "@d1testflare/runner-vm";
import {
  CronScheduler,
  SchedulerPlugin,
  startScheduler,
} from "@d1testflare/scheduler";
import { Log, NoOpLog } from "@d1testflare/shared";
import { SitesPlugin } from "@d1testflare/sites";
import { WebSocketPlugin } from "@d1testflare/web-sockets";
import sourceMap from "source-map-support";
import { startREPL } from "./repl";
import { VariedStorageFactory } from "./storage";

// MiniflareCore will ensure CorePlugin is first and BindingsPlugin is last,
// so help it out by doing it ourselves so it doesn't have to
export const PLUGINS = {
  // Core
  CorePlugin,
  HTTPPlugin,
  SchedulerPlugin,
  BuildPlugin,

  // Storage
  D1Plugin,
  KVPlugin,
  R2Plugin,
  DurableObjectsPlugin,
  CachePlugin,
  SitesPlugin,

  // No options
  HTMLRewriterPlugin,
  WebSocketPlugin,

  BindingsPlugin,
};

export type Plugins = typeof PLUGINS;

export type MiniflareOptions = Omit<
  MiniflareCoreOptions<Plugins>,
  "debug" | "verbose" | "updateCheck"
> & {
  log?: Log;
  sourceMap?: boolean;
  scriptRequired?: boolean;
};

export class Miniflare extends MiniflareCore<Plugins> {
  #storageFactory: VariedStorageFactory;

  constructor(options?: MiniflareOptions) {
    if (options?.sourceMap) {
      // Node has the --enable-source-maps flag, but this doesn't work for VM scripts.
      // It also doesn't expose a way of flushing the source map cache, which we need
      // so previous versions of worker code don't end up in stack traces.
      sourceMap.install({ emptyCacheBetweenOperations: true });
    }

    const storageFactory = new VariedStorageFactory();
    super(
      PLUGINS,
      {
        log: options?.log ?? new NoOpLog(),
        storageFactory,
        scriptRunner: new VMScriptRunner(),
        scriptRequired: options?.scriptRequired ?? true,
      },
      options
    );
    this.#storageFactory = storageFactory;
  }

  async dispose(): Promise<void> {
    await super.dispose();
    await this.#storageFactory.dispose();
  }

  async getD1Database(database: string): Promise<D1Database> {
    const plugin = (await this.getPlugins()).D1Plugin;
    const storage = this.getPluginStorage("D1Plugin");
    return plugin.getDatabase(storage, database);
  }

  async getKVNamespace(namespace: string): Promise<KVNamespace> {
    const plugin = (await this.getPlugins()).KVPlugin;
    const storage = this.getPluginStorage("KVPlugin");
    return plugin.getNamespace(storage, namespace);
  }

  async getR2Bucket(bucket: string): Promise<R2Bucket> {
    const plugin = (await this.getPlugins()).R2Plugin;
    const storage = this.getPluginStorage("R2Plugin");
    return plugin.getBucket(storage, bucket);
  }

  async getCaches(): Promise<CacheStorage> {
    const plugin = (await this.getPlugins()).CachePlugin;
    return plugin.getCaches();
  }

  async getDurableObjectNamespace(
    objectName: string
  ): Promise<DurableObjectNamespace> {
    const plugin = (await this.getPlugins()).DurableObjectsPlugin;
    const storage = this.getPluginStorage("DurableObjectsPlugin");
    return plugin.getNamespace(storage, objectName);
  }

  async getDurableObjectStorage(
    id: DurableObjectId
  ): Promise<DurableObjectStorage> {
    const plugin = (await this.getPlugins()).DurableObjectsPlugin;
    const storage = this.getPluginStorage("DurableObjectsPlugin");
    const state = await plugin.getObject(storage, id);
    return state.storage;
  }

  createServer(
    options?: http.ServerOptions & https.ServerOptions
  ): Promise<http.Server | https.Server> {
    return createServer(this, options);
  }

  startServer(
    options?: http.ServerOptions & https.ServerOptions
  ): Promise<http.Server | https.Server> {
    return startServer(this, options);
  }

  startScheduler(): Promise<CronScheduler<Plugins>> {
    return startScheduler(this);
  }

  startREPL(): Promise<void> {
    return startREPL(this);
  }

  async getOpenURL(): Promise<string | undefined> {
    const {
      open,
      httpsEnabled,
      host = "localhost",
      port = DEFAULT_PORT,
    } = (await this.getPlugins()).HTTPPlugin;
    if (!open) return;
    if (typeof open === "string") return open;
    const protocol = httpsEnabled ? "https" : "http";
    return `${protocol}://${host}:${port}/`;
  }
}
