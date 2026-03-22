import React, { forwardRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, hint, error, className = "", ...rest },
  ref
) {
  return (
    <label className={`flex w-full flex-col gap-1 ${className}`}>
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">{label}</span>
      ) : null}
      <textarea
        ref={ref}
        aria-invalid={!!error}
        className={`min-h-[110px] w-full resize-y rounded-xl border bg-cream-50/80 px-3 py-2 text-sm text-cocoa-900 placeholder:text-cocoa-400 focus:outline-none focus:ring-2 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200/70"
            : "border-cream-200/70 focus:border-berry-300 focus:ring-berry-200/70"
        }`}
        {...rest}
      />
      {error ? (
        <span className="text-xs font-semibold text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-cocoa-500">{hint}</span>
      ) : null}
    </label>
  );
});

export default Textarea;
