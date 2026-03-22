export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-cream-200 bg-white p-4 shadow-card transition duration-200 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}
