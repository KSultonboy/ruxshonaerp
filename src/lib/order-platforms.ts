import type { Order, PlatformKey } from "@/lib/types";

function normalize(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function matchesPlatformOrder(order: Order, platformKey: PlatformKey) {
  const source = normalize(order.source);
  const channel = normalize(order.channel);

  switch (platformKey) {
    case "website":
      return source === "WEBSITE" || channel === "WEBSITE";
    case "telegram":
      return source === "TELEGRAM" || channel === "TELEGRAM";
    case "mobile":
      return source === "MOBILE";
    default:
      return false;
  }
}

export function platformOrderLabel(platformKey: PlatformKey) {
  switch (platformKey) {
    case "website":
      return "Website";
    case "telegram":
      return "Telegram bot";
    case "mobile":
      return "Mobile app";
    default:
      return platformKey;
  }
}
