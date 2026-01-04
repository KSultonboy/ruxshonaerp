import { API_BASE_URL } from "./config";

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }

    // 204 bo‘lsa body yo‘q
    if (res.status === 204) return undefined as T;

    return (await res.json()) as T;
}
