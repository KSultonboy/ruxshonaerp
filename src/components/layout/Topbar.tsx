"use client";

import s from "./Topbar.module.scss";

export default function Topbar() {
    return (
        <header className={s.topbar}>
            <div className="container">
                <div className={s.row}>
                    <div>
                        <div className={s.hello}>Assalomu alaykum 👋</div>
                        <div className={s.small}>UI-first: backend keyin ulanadi</div>
                    </div>
                    <div className={s.pill}>Ruxshona Tort • ERP</div>
                </div>
            </div>
        </header>
    );
}
