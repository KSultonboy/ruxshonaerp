import type { CashEntry, CashEntrySource, PaymentMethod } from "@/lib/types";
import { getJSON, safeId, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

type CashCreateDTO = {
  date: string;
  sourceType: CashEntrySource;
  sourceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
};

function nowISO() {
  return new Date().toISOString();
}

function readEntries() {
  return getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []);
}

function writeEntries(items: CashEntry[]) {
  setJSON(STORAGE_KEYS.cashEntries, items);
}

const local = {
  async list() {
    return readEntries();
  },
  async create(dto: CashCreateDTO) {
    const now = nowISO();
    const entry: CashEntry = {
      id: safeId("cash"),
      date: dto.date,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      note: dto.note?.trim(),
      createdAt: now,
      updatedAt: now,
    };
    writeEntries([entry, ...readEntries()]);
    return entry;
  },
  async remove(id: string) {
    writeEntries(readEntries().filter((entry) => entry.id !== id));
  },
};

const api = {
  async list() {
    const items = await apiFetch<CashEntry[]>("/payments");
    return items.map((entry) => ({
      ...entry,
      sourceId: entry.sourceId || entry.branchId || entry.shopId || "",
    }));
  },
  async create(dto: CashCreateDTO) {
    const entry = await apiFetch<CashEntry>("/payments", { method: "POST", body: JSON.stringify(dto) });
    return {
      ...entry,
      sourceId: entry.sourceId || entry.branchId || entry.shopId || dto.sourceId,
    };
  },
  async remove(id: string) {
    return apiFetch<void>(`/payments/${id}`, { method: "DELETE" });
  },
};

export const cashService = SERVICE_MODE === "api" ? api : local;
