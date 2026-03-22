import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  asChild?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-berry-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-berry-700 text-white shadow-glow-sm hover:bg-berry-800",
  ghost:   "border border-cream-200 bg-white text-cocoa-700 hover:bg-cream-100 hover:border-cream-300",
  danger:  "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  asChild = false,
  children,
  ...rest
}: Props) {
  const classes = `${base} ${variants[variant]} ${className}`;
  if (asChild && React.isValidElement(children)) {
    const childClassName = (children.props as { className?: string }).className ?? "";
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: `${classes} ${childClassName}`.trim(),
      ...rest,
    } as React.Attributes & { className: string });
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
