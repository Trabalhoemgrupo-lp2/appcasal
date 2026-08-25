const ISO_DATE_WITH_FOUR_DIGIT_YEAR = /^(\d{4})-(\d{2})-(\d{2})$/;
const BRAZILIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export const FOUR_DIGIT_YEAR_DATE_HINT = "Digite a data completa no formato DD/MM/AAAA, por exemplo 23/06/2024.";

/**
 * Protege valores persistidos para que anos abreviados, como "26", nunca cheguem ao caderno.
 */
export function hasFourDigitYear(value: string): boolean {
  const match = ISO_DATE_WITH_FOUR_DIGIT_YEAR.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return year >= 1000 && year <= 9999;
}

export function formatBrazilianDateInput(value: string): string {
  if (!hasFourDigitYear(value)) return "";
  const match = ISO_DATE_WITH_FOUR_DIGIT_YEAR.exec(value);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatBrazilianDateTyping(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBrazilianDateInput(value: string): string | null {
  const match = BRAZILIAN_DATE.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1000 || year > 9999) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
