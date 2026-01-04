import React, { forwardRef } from "react";
import s from "./Textarea.module.scss";

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
        <label className={`${s.wrap} ${className}`}>
            {label && <div className={s.label}>{label}</div>}
            <textarea ref={ref} className={`${s.ta} ${error ? s.invalid : ""}`} {...rest} />
            {error ? <div className={s.error}>{error}</div> : hint ? <div className={s.hint}>{hint}</div> : null}
        </label>
    );
});

export default Textarea;
