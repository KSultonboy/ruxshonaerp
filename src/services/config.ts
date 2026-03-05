export const SERVICE_MODE: "local" | "api" =
    (process.env.NEXT_PUBLIC_SERVICE_MODE as "local" | "api") ?? "api";

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.ruhshonatort.com/api";

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
