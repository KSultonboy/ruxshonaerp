export function safeId(prefix = "id") {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function getJSON<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function setJSON<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
}
