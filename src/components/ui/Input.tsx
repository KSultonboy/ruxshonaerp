import React, { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className = "", ...rest },
  ref
) {
  return (
    <label className={`flex w-full flex-col gap-1 ${className}`}>
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">{label}</span>
      ) : null}
      <input
        ref={ref}
        aria-invalid={!!error}
        className={`w-full rounded-xl border bg-cream-50/80 px-3 py-2 text-base text-cocoa-900 placeholder:text-cocoa-400 transition duration-200 focus:outline-none focus:ring-2 sm:text-sm ${error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200/70"
            : "border-cream-200/70 hover:border-cream-300 focus:border-berry-300 focus:ring-berry-200/70"
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

export default Input;
