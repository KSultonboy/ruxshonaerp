import React, { forwardRef } from "react";
import s from "./Input.module.scss";

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
        <label className={`${s.wrap} ${className}`}>
            {label && <div className={s.label}>{label}</div>}
            <input ref={ref} className={`${s.input} ${error ? s.invalid : ""}`} {...rest} />
            {error ? (
                <div className={s.error}>{error}</div>
            ) : hint ? (
                <div className={s.hint}>{hint}</div>
            ) : null}
        </label>
    );
});

export default Input;
