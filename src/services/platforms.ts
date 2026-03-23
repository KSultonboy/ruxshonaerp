import type { PlatformConfig, PlatformKey, PlatformStatus } from "@/lib/types";
import { getJSON, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

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

const local = {
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

const api = {
  async get(key: PlatformKey) {
    return apiFetch<PlatformConfig>(`/platform-configs/${key}`);
  },

  async save(config: PlatformConfig) {
    return apiFetch<PlatformConfig>(`/platform-configs/${config.key}`, {
      method: "PUT",
      body: JSON.stringify({
        status: config.status,
        url: config.url,
        username: config.username,
        token: config.token,
        packageId: config.packageId,
        note: config.note,
      }),
    });
  },

  async setStatus(key: PlatformKey, status: PlatformStatus) {
    return apiFetch<PlatformConfig>(`/platform-configs/${key}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },
};

export const platformsService = SERVICE_MODE === "api" ? api : local;
