// Identifiering av exporttyp utifrån vilka fält som finns.
import { cleanText } from "./format.js";

/**
 * @typedef {Object} SourceType
 * @property {"transactionList"|"accounting"|"payrollDraftHr"|"payrollDraftI"|"unknown"} sourceKey
 * @property {string} sourceLabel
 * @property {string} sourceShortLabel
 * @property {"normal"|"warning"} sourceTone
 * @property {string} dateLabel
 * @property {string} sourceDescription
 */

/**
 * @param {boolean} hasBookingDate
 * @param {boolean} hasAccount
 * @param {boolean} hasScope
 * @param {string} [explicitSourceType]
 * @returns {SourceType}
 */
export function getSourceType(hasBookingDate, hasAccount, hasScope, explicitSourceType = "") {
  if (explicitSourceType === "payrollDraftI") {
    return {
      sourceKey: "payrollDraftI",
      sourceLabel: "Löneunderlag från I:",
      sourceShortLabel: "Löneunderlag",
      sourceTone: "warning",
      dateLabel: "Bokföringsdatum",
      sourceDescription: "Löneunderlaget från löneservice på I:. Visar registrerade lönepåverkande poster och beräkningsunderlag för perioden."
    };
  }

  if (explicitSourceType === "payrollDraftHr") {
    return {
      sourceKey: "payrollDraftHr",
      sourceLabel: "Löneunderlagslista (Hr+)",
      sourceShortLabel: "Löneunderlagslista",
      sourceTone: "warning",
      dateLabel: "Bokföringsdatum",
      sourceDescription: "Löneunderlaget från Ekonomirutin → Löneunderlagslista. Visar registrerade lönepåverkande poster och beräkningsunderlag för vald period."
    };
  }

  if (explicitSourceType === "transactionList") {
    return {
      sourceKey: "transactionList",
      sourceLabel: "Transaktionslista",
      sourceShortLabel: "Trans.lista",
      sourceTone: "normal",
      dateLabel: "Utbetalningsdatum",
      sourceDescription: "Transaktionslista från Rapporter & Dokument. Visar lönearter, skatt och nettolön när löneservice har börjat arbeta med lönerna."
    };
  }

  if (hasBookingDate && hasAccount) {
    return {
      sourceKey: "accounting",
      sourceLabel: "Bokföringsposter",
      sourceShortLabel: "Bokf.poster",
      sourceTone: "normal",
      dateLabel: "Utbetalning/bokföringsdatum",
      sourceDescription: "Komplett löneunderlag när månaden är klar."
    };
  }

  if (!hasBookingDate && hasScope) {
    return {
      sourceKey: "payrollDraftHr",
      sourceLabel: "Löneunderlagslista (Hr+)",
      sourceShortLabel: "Löneunderlagslista",
      sourceTone: "warning",
      dateLabel: "Period",
      sourceDescription: "Löneunderlagslista från Ekonomirutin. Importen visar registrerade lönepåverkande poster för vald period."
    };
  }

  return {
    sourceKey: "unknown",
    sourceLabel: "Okänd exporttyp",
    sourceShortLabel: "Okänd",
    sourceTone: "warning",
    dateLabel: "Bokföringsdatum",
    sourceDescription: "Exporttypen kunde inte identifieras säkert. Kontrollera att filen kommer från Hr+ och är exporterad i formatet Kalkylprogram."
  };
}

// Gissar typ från objektform-rader (fallback) utifrån vilka rubriker som finns.
export function inferSourceTypeFromRawRows(rows) {
  if (!rows.length) return "unknown";
  const headers = Object.keys(rows[0] || {}).map((value) => cleanText(value).toLowerCase());

  if (headers.includes("bokföringsdatum")) return "accounting";
  if (headers.includes("arbetstagare") && headers.includes("namn") && headers.includes("löneart") && headers.includes("belopp")) {
    return "transactionList";
  }
  return "unknown";
}
