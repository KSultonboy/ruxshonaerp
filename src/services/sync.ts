"use client";

import { getJSON, setJSON } from "@/lib/storage";

const QUEUE_KEY = "offline_sync_queue";

type QueuedBody =
    | { type: "none" }
    | { type: "text"; value: string }
    | { type: "json"; value: unknown };

interface QueuedMutation {
    id: string;
    url: string;
    method: string;
    body: QueuedBody;
    headers?: Record<string, string>;
    timestamp: number;
}

function encodeBody(body?: unknown): QueuedBody {
    if (body === undefined || body === null) {
        return { type: "none" };
    }

    if (typeof body === "string") {
        return { type: "text", value: body };
    }

    return { type: "json", value: body };
}

function decodeBody(body: QueuedBody): string | undefined {
    if (body.type === "none") {
        return undefined;
    }

    if (body.type === "text") {
        return body.value;
    }

    return JSON.stringify(body.value);
}

export const syncService = {
    getQueue(): QueuedMutation[] {
        return getJSON<QueuedMutation[]>(QUEUE_KEY, []);
    },

    enqueue(url: string, method: string, body?: unknown, headers?: Record<string, string>) {
        const queue = this.getQueue();
        const mutation: QueuedMutation = {
            id: Math.random().toString(36).slice(2),
            url,
            method,
            body: encodeBody(body),
            headers,
            timestamp: Date.now(),
        };
        setJSON(QUEUE_KEY, [...queue, mutation]);

        // Dispatch event to update UI
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sync:enqueued", { detail: mutation }));
        }
    },

    async processQueue() {
        const queue = this.getQueue();
        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} offline mutations...`);
        const remaining: QueuedMutation[] = [];

        for (const mutation of queue) {
            try {
                const res = await fetch(mutation.url, {
                    method: mutation.method,
                    headers: mutation.headers,
                    body: decodeBody(mutation.body),
                });

                if (!res.ok) {
                    // If it's a permanent error (e.g. 400), we might want to discard it
                    // but for simplicity, we'll just log it.
                    console.error(`Failed to sync mutation ${mutation.id}:`, await res.text());
                }
            } catch (e) {
                // Still offline or transient error, keep in queue
                remaining.push(mutation);
            }
        }

        setJSON(QUEUE_KEY, remaining);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sync:processed", { detail: { remaining: remaining.length } }));
        }
    }
};

if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        syncService.processQueue();
    });

    if (window.navigator.onLine) {
        setTimeout(() => {
            syncService.processQueue();
        }, 0);
    }
}
