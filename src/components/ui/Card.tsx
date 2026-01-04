import s from "./Card.module.scss";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`${s.card} ${className}`}>{children}</div>;
}
