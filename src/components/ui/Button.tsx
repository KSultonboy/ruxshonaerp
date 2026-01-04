import React from "react";
import s from "./Button.module.scss";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger";
};

export default function Button({
    variant = "primary",
    className = "",
    type = "button",
    ...rest
}: Props) {
    return <button type={type} className={`${s.btn} ${s[variant]} ${className}`} {...rest} />;
}
