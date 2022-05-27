import { URL } from "url";
import { Request, Response } from "@miniflare/core";
import {
  AlarmStore,
  DurableObject,
  DurableObjectId,
  DurableObjectState,
} from "@miniflare/durable-objects";
import { Context } from "@miniflare/shared";
import { MemoryStorageFactory } from "@miniflare/shared-test";

export const testIdHex = // ID with name "test" for object with name "TEST"
  "a856dbbd5109f5217920084de35ee0a24072ca790341ed4e94ee059335e587e5";
export const testId = new DurableObjectId("TEST", testIdHex, "instance");
export const testKey = `TEST:${testIdHex}`;
export const alarmStore = new AlarmStore();
alarmStore.setupStore(new MemoryStorageFactory());

// Durable Object that stores its constructed data and requests in storage
export class TestObject implements DurableObject {
  private static INSTANCE_COUNT = 0;
  private readonly instanceId: number;

  constructor(private readonly state: DurableObjectState, env: Context) {
    this.instanceId = TestObject.INSTANCE_COUNT++;
    void state.blockConcurrencyWhile(() =>
      state.storage.put({ id: state.id.toString(), env })
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/instance") {
      return new Response(this.instanceId.toString());
    }

    const count = ((await this.state.storage.get<number>("count")) ?? 0) + 1;
    // noinspection ES6MissingAwait
    void this.state.storage.put({
      [`request${count}`]: request.url,
      count,
    });
    return new Response(
      `${this.state.id}:request${count}:${request.method}:${request.url}`
    );
  }

  async alarm(): Promise<void> {}
}
