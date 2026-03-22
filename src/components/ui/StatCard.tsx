import Card from "./Card";

type StatCardVariant = "default" | "success" | "danger" | "warning" | "info";

const variantStyles: Record<StatCardVariant, { icon: string; value: string; accent: string }> = {
  default: { icon: "bg-slate-100 text-slate-500",   value: "text-berry-700",    accent: "bg-berry-50" },
  success: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700",  accent: "bg-emerald-50" },
  danger:  { icon: "bg-red-50 text-red-600",         value: "text-red-700",      accent: "bg-red-50" },
  warning: { icon: "bg-amber-50 text-amber-600",     value: "text-amber-700",    accent: "bg-amber-50" },
  info:    { icon: "bg-blue-50 text-blue-600",       value: "text-blue-700",     accent: "bg-blue-50" },
};

export default function StatCard({
  title,
  value,
  hint,
  variant = "default",
  icon,
}: {
  title: string;
  value: string;
  hint?: string;
  variant?: StatCardVariant;
  icon?: React.ReactNode;
}) {
  const styles = variantStyles[variant];
  return (
    <Card className="group relative overflow-hidden motion-safe:animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cocoa-500">{title}</div>
          <div className={`mt-2 text-2xl font-bold leading-none ${styles.value}`}>{value}</div>
          {hint ? <div className="mt-2 text-xs text-cocoa-400">{hint}</div> : null}
        </div>
        {icon ? (
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
            {icon}
          </div>
        ) : (
          <div
            aria-hidden="true"
            className={`h-10 w-10 flex-shrink-0 rounded-lg ${styles.accent} transition-transform duration-300 group-hover:scale-110`}
          />
        )}
      </div>
    </Card>
  );
}
