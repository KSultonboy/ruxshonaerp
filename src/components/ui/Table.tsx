export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-cream-200/70 bg-white/80 shadow-card">
      {children}
    </div>
  );
}

export function T({ children }: { children: React.ReactNode }) {
  return (
    <table className="min-w-full border-separate border-spacing-0 text-left text-[11px] text-cocoa-900 sm:text-sm [&_thead_th]:bg-cream-100 [&_thead_th]:px-2 [&_thead_th]:py-3 sm:[&_thead_th]:px-4 [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.2em] [&_thead_th:first-child]:rounded-tl-2xl [&_thead_th:last-child]:rounded-tr-2xl [&_tbody_td]:border-t [&_tbody_td]:border-cream-200/70 [&_tbody_td]:px-2 [&_tbody_td]:py-3 sm:[&_tbody_td]:px-4 [&_tbody_tr]:bg-white/70 [&_tbody_tr:nth-child(even)]:bg-cream-50/60 [&_tbody_tr:hover]:bg-cream-100/70">
      {children}
    </table>
  );
}
