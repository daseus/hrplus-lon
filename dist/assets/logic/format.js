// Rena formaterings- och talhjälpare. Inga beroenden på DOM eller state.

export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized;
  if (hasComma && hasDot) {
    // Båda finns: den högraste är decimaltecken, den andra är tusentalsavgränsare.
    normalized = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (hasComma) {
    normalized = s.replace(",", ".");
  } else {
    // Endast punkt: tolkas som tusentalsavgränsare (svenskt format).
    normalized = s.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  return text;
}

export function formatDateRange(fromDate, toDate) {
  if (fromDate && toDate && fromDate !== toDate) return `${fromDate} - ${toDate}`;
  return fromDate || toDate || "-";
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function formatOptionalCurrency(value) {
  return value ? formatCurrency(value) : "-";
}

export function formatDecimal(value) {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function formatInteger(value) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value || 0);
}

export function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

export function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
