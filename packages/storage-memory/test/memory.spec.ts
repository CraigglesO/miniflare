import { Storage, StoredValueMeta } from "@d1testflare/shared";
import {
  TestStorageFactory,
  storageMacros,
  testClock,
} from "@d1testflare/shared-test";
import { MemoryStorage } from "@d1testflare/storage-memory";
import test, { ExecutionContext } from "ava";

class MemoryStorageFactory extends TestStorageFactory {
  name = "MemoryStorage";

  async factory(
    t: ExecutionContext,
    seed: Record<string, StoredValueMeta>
  ): Promise<Storage> {
    const map = new Map(Object.entries(seed));
    return new MemoryStorage(map, testClock);
  }
}

const storageFactory = new MemoryStorageFactory();
for (const macro of storageMacros) {
  test(macro, storageFactory);
}
