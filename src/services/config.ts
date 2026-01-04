export const SERVICE_MODE: "local" | "api" =
    (process.env.NEXT_PUBLIC_SERVICE_MODE as "local" | "api") ?? "local";

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
