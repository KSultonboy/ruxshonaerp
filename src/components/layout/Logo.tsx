export default function Logo() {
    return (
        <div
            style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "linear-gradient(180deg, var(--primary), var(--primary-2))",
                display: "grid",
                placeItems: "center",
                color: "white",
                fontWeight: 900,
                letterSpacing: "0.5px",
                boxShadow: "0 10px 22px rgba(122,11,11,0.22)",
            }}
            aria-label="RuxshonaERP logo"
        >
            RT
        </div>
    );
}
