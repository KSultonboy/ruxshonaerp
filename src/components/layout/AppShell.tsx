import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import s from "./AppShell.module.scss";
import { ToastProvider } from "@/components/ui/toast/ToastProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <div className={s.shell}>
                <Sidebar />
                <div className={s.main}>
                    <Topbar />
                    <div className={s.content}>
                        <div className="container">{children}</div>
                    </div>
                </div>
            </div>
        </ToastProvider>
    );
}
