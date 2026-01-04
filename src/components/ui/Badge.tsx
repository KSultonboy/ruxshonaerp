import s from "./Badge.module.scss";

export default function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" }) {
    return <span className={`${s.badge} ${s[tone]}`}>{children}</span>;
}
