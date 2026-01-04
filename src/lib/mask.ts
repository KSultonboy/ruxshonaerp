export function onlyDigits(v: string) {
    return (v ?? "").replace(/\D/g, "");
}

export function formatDigitsWithSpaces(digits: string) {
    const s = onlyDigits(digits);
    if (!s) return "";
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
