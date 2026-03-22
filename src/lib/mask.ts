export function onlyDigits(v: string) {
    return (v ?? "").replace(/\D/g, "");
}

export function formatDigitsWithSpaces(digits: string) {
    const raw = String(digits ?? "").trim();
    if (!raw) return "";

    const normalized = raw.replace(/\s+/g, "").replace(/,/g, ".");
    const negative = normalized.startsWith("-");
    const unsigned = negative ? normalized.slice(1) : normalized;

    const firstDot = unsigned.indexOf(".");
    const hasDot = firstDot >= 0;

    const intRaw = hasDot ? unsigned.slice(0, firstDot) : unsigned;
    const fracRaw = hasDot ? unsigned.slice(firstDot + 1) : "";

    const intDigits = intRaw.replace(/\D/g, "");
    const fracDigits = fracRaw.replace(/\D/g, "");

    if (!intDigits && !fracDigits) return "";

    const formattedInt = (intDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const sign = negative ? "-" : "";

    if (fracDigits) {
        return `${sign}${formattedInt}.${fracDigits}`;
    }

    if (hasDot && unsigned.endsWith(".")) {
        return `${sign}${formattedInt}.`;
    }

    return `${sign}${formattedInt}`;
}
