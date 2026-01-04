import Card from "./Card";

export default function StatCard({
    title,
    value,
    hint,
}: {
    title: string;
    value: string;
    hint?: string;
}) {
    return (
        <Card>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)", marginTop: 6 }}>{value}</div>
            {hint ? <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>{hint}</div> : null}
        </Card>
    );
}
