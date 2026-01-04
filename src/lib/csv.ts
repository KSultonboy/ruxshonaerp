function escapeCSV(v: unknown) {
    const s = String(v ?? "");
    // vergul, qo‘shtirnoq, new line bo‘lsa qo‘shtirnoq bilan o‘raymiz
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function buildCSV(headers: string[], rows: Array<Array<unknown>>) {
    const lines: string[] = [];
    lines.push(headers.map(escapeCSV).join(","));
    for (const r of rows) {
        lines.push(r.map(escapeCSV).join(","));
    }
    return lines.join("\n");
}

export function downloadCSV(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

export function fileStamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
