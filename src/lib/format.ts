export function moneyUZS(value: number) {
    return new Intl.NumberFormat("uz-UZ").format(value) + " so‘m";
}

export function safeDateLabel(yyyy_mm_dd: string) {
    // yyyy-mm-dd -> dd.mm.yyyy
    const [y, m, d] = yyyy_mm_dd.split("-");
    return `${d}.${m}.${y}`;
}

export function formatCurrency(value: number) {
    return moneyUZS(value);
}
