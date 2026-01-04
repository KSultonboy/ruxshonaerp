import s from "./Table.module.scss";

export function Table({ children }: { children: React.ReactNode }) {
    return <div className={s.wrap}>{children}</div>;
}

export function T({ children }: { children: React.ReactNode }) {
    return <table className={s.table}>{children}</table>;
}
