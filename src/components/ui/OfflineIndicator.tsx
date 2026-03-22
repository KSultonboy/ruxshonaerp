"use client";

import { useEffect, useState } from "react";
import { syncService } from "@/services/sync";
import Badge from "./Badge";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function OfflineIndicator() {
    const { t } = useI18n();
    const [isOnline, setIsOnline] = useState(true);
    const [queueCount, setQueueCount] = useState(0);

    useEffect(() => {
        if (typeof window === "undefined") return;

        setIsOnline(window.navigator.onLine);
        setQueueCount(syncService.getQueue().length);

        const handleOnline = () => {
            setIsOnline(true);
            syncService.processQueue();
        };
        const handleOffline = () => setIsOnline(false);

        const handleSyncUpdate = () => {
            setQueueCount(syncService.getQueue().length);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener("sync:enqueued", handleSyncUpdate);
        window.addEventListener("sync:processed", handleSyncUpdate);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("sync:enqueued", handleSyncUpdate);
            window.removeEventListener("sync:processed", handleSyncUpdate);
        };
    }, []);

    if (isOnline && queueCount === 0) return null;

    return (
        <div className="flex items-center gap-2">
            {!isOnline && (
                <Badge tone="neutral" className="bg-rose-100 text-rose-700 border-rose-200 animate-pulse">
                    {t("Oflayn")}
                </Badge>
            )}
            {queueCount > 0 && (
                <Badge tone="primary" className="bg-amber-100 text-amber-700 border-amber-200">
                    {queueCount} {t("kutilmoqda")}
                </Badge>
            )}
        </div>
    );
}
