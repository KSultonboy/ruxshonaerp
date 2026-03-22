import type { PlatformConfig, PlatformKey, PlatformStatus } from "@/lib/types";
import { getJSON, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";

type PlatformStore = Record<PlatformKey, PlatformConfig>;

function readStore(): PlatformStore {
  return getJSON<PlatformStore>(STORAGE_KEYS.platforms, {} as PlatformStore);
}

function writeStore(store: PlatformStore) {
  setJSON(STORAGE_KEYS.platforms, store);
}

function defaultConfig(key: PlatformKey): PlatformConfig {
  return {
    key,
    status: "DISCONNECTED",
  };
}

export const platformsService = {
  async get(key: PlatformKey) {
    const store = readStore();
    return store[key] ?? defaultConfig(key);
  },
  async save(config: PlatformConfig) {
    const store = readStore();
    store[config.key] = {
      ...store[config.key],
      ...config,
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);
    return store[config.key];
  },
  async setStatus(key: PlatformKey, status: PlatformStatus) {
    return this.save({ key, status });
  },
};
