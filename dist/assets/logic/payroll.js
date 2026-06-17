// Hjälpare för löneunderlag (payrollDraftHr / payrollDraftI): identifiering av
// brutto-/nettorader och avstämning av dolda nettoavdrag.
import { cleanText, sum, roundCurrency } from "./format.js";

export function isPayrollGrossRow(row) {
  const payCode = cleanText(row && row.payCode).toLowerCase();
  const description = cleanText(row && row.description).toLowerCase();
  return /^bru$|^brutto$/.test(payCode) || /bruttolön|brutto/.test(description);
}

export function isPayrollNetPayRow(row) {
  const payCode = cleanText(row && row.payCode).toLowerCase();
  const description = cleanText(row && row.description).toLowerCase();
  return /^990\b/.test(payCode) || /utbetald\s*nett[oö]lön/.test(description);
}

export function isPayrollSummaryRow(row) {
  return isPayrollGrossRow(row) || isPayrollNetPayRow(row);
}

// För payrollDraftI: om nettolön är lägre än brutto + skatt med mer än 500 kr
// finns ett dolt avdrag (t.ex. utmätning) som inte är en egen post. Lägg till en
// härledd rad som synliggör mellanskillnaden.
export function addPayrollReconciliationRows(rows, sourceKey) {
  if (sourceKey !== "payrollDraftI") return rows;
  if (rows.some((row) => row.isDerived)) return rows;

  const gross = sum(rows.filter((row) => isPayrollGrossRow(row)), "amount");
  const netPay = Math.abs(sum(rows.filter((row) => isPayrollNetPayRow(row)), "amount"));
  if (!gross || !netPay) return rows;

  const tax = sum(rows.filter((row) => row.category === "tax" && !isPayrollSummaryRow(row)), "amount");
  const hiddenNetDeduction = roundCurrency(netPay - (gross + tax));
  if (hiddenNetDeduction >= -500) return rows;

  const baseRow = rows.find((row) => !isPayrollSummaryRow(row)) || rows[0] || {};
  return [
    ...rows,
    {
      ...baseRow,
      original: null,
      payCode: "avst",
      description: "Beräknat nettoavdrag/utmätning",
      unitPrice: 0,
      hours: 0,
      calendarDays: 0,
      workDays: 0,
      amount: hiddenNetDeduction,
      fromDate: "",
      toDate: "",
      scope: 0,
      account: "Avstämt mot nettolön",
      costParts: [],
      category: "tax",
      isTechnical: false,
      isDerived: true
    }
  ];
}
