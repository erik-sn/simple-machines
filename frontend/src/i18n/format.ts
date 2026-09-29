// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Display formatting on the active locale. API times are UTC ISO-8601 and are
// converted here, at render; date-fns is for arithmetic, not display.
import i18n from "./index";

// Intl constructors are expensive: one instance per locale and shape.
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateTimeFormat(locale: string): Intl.DateTimeFormat {
  let format = dateTimeFormats.get(locale);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    dateTimeFormats.set(locale, format);
  }
  return format;
}

function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

// Medium date and short time in the user's zone, e.g. "Sep 25, 2026, 3:04 PM".
// Render inside <time dateTime={iso}> so the machine-readable value travels.
export function formatDateTime(iso: string): string {
  return dateTimeFormat(i18n.language).format(new Date(iso));
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return numberFormat(i18n.language, options).format(value);
}

// currency is an ISO 4217 code ("EUR"); the amount is in major units.
export function formatCurrency(amount: number, currency: string): string {
  return formatNumber(amount, { style: "currency", currency });
}
