export type BadgeTone = "neutral" | "primary" | "neutralHighlight";

export default function Badge({
  children,
  tone = "neutral",
  className = ""
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "border-berry-700/80 bg-berry-700 text-cream-50"
      : tone === "neutralHighlight"
        ? "border-amber-200 bg-amber-100 text-amber-700"
        : "border-cream-200/80 bg-cream-100 text-cocoa-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass} ${className}`}>
      {children}
    </span>
  );
}
