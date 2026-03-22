import type { Order, OrderChannel, OrderStatus } from "@/lib/types";
import { getJSON, safeId, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

type OrderCreateDTO = {
  customerName: string;
  phone?: string;
  address?: string;
  channel: OrderChannel;
  total: number;
  note?: string;
};

type OrderUpdateDTO = Partial<Omit<Order, "id" | "createdAt" | "updatedAt">>;

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readOrders() {
  return getJSON<Order[]>(STORAGE_KEYS.orders, []);
}

function writeOrders(items: Order[]) {
  setJSON(STORAGE_KEYS.orders, items);
}

async function listRemote() {
  return apiFetch<Order[]>("/orders");
}

async function createRemote(dto: OrderCreateDTO) {
  return apiFetch<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

async function updateStatusRemote(id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export const ordersService = {
  async list() {
    if (SERVICE_MODE === "api") return listRemote();
    return readOrders();
  },
  async create(dto: OrderCreateDTO) {
    if (SERVICE_MODE === "api") return createRemote(dto);

    const now = nowISO();
    const order: Order = {
      id: safeId("order"),
      date: todayISO(),
      customerName: dto.customerName.trim(),
      phone: dto.phone?.trim(),
      address: dto.address?.trim(),
      source: "ERP",
      channel: dto.channel,
      status: "NEW",
      total: dto.total,
      note: dto.note?.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const items = readOrders();
    writeOrders([order, ...items]);
    return order;
  },
  async update(id: string, patch: OrderUpdateDTO) {
    if (SERVICE_MODE === "api") {
      if (patch.status) {
        await updateStatusRemote(id, patch.status);
      }
      return;
    }

    const items = readOrders().map((order) =>
      order.id === id
        ? {
            ...order,
            ...patch,
            updatedAt: nowISO(),
          }
        : order
    );
    writeOrders(items);
  },
  async updateStatus(id: string, status: OrderStatus) {
    if (SERVICE_MODE === "api") {
      await updateStatusRemote(id, status);
      return;
    }
    await this.update(id, { status });
  },
  async remove(id: string) {
    writeOrders(readOrders().filter((order) => order.id !== id));
  },
};
