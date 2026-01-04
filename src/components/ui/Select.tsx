import React, { forwardRef } from "react";
import s from "./Select.module.scss";

type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    hint?: string;
    error?: string;
    options: Option[];
};

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
    { label, hint, error, options, className = "", ...rest },
    ref
) {
    return (
        <label className={`${s.wrap} ${className}`}>
            {label && <div className={s.label}>{label}</div>}
            <select ref={ref} className={`${s.select} ${error ? s.invalid : ""}`} {...rest}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {error ? <div className={s.error}>{error}</div> : hint ? <div className={s.hint}>{hint}</div> : null}
        </label>
    );
});

export default Select;
