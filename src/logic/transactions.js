// Parsning av transaktionslista (avvikande format med metadata-rader).
import { cleanText, parseNumber } from "./format.js";
import { splitFullName, splitPayItem } from "./names.js";

export function parseTransactionList(matrix) {
  const headerIndex = matrix.findIndex((row) => {
    const labels = row.map((cell) => cleanText(cell).toLowerCase());
    return labels.includes("arbetstagare")
      && labels.includes("namn")
      && labels.includes("löneart")
      && labels.includes("belopp");
  });
  if (headerIndex === -1) return [];

  const header = matrix[headerIndex].map(cleanText);
  const employeeIndex = header.findIndex((value) => value === "Arbetstagare");
  const nameIndex = header.findIndex((value) => value === "Namn");
  const typeIndex = header.findIndex((value) => value === "Typ");
  const payItemIndex = header.findIndex((value) => value === "Löneart");
  const accountIndex = header.findIndex((value) => value === "Konto");
  const costCenterIndex = header.findIndex((value) => value === "Avvikande kostnadsställe");
  const amountIndex = header.findIndex((value) => value === "Belopp");
  const paymentDate = findTransactionPaymentDate(matrix);
  const company = findTransactionCompany(matrix, headerIndex);

  if (employeeIndex === -1 || nameIndex === -1 || payItemIndex === -1 || amountIndex === -1) return [];

  return matrix.slice(headerIndex + 1)
    .map((row) => {
      const workerId = cleanText(row[employeeIndex]);
      const fullName = cleanText(row[nameIndex]);
      const payItem = cleanText(row[payItemIndex]);
      const amount = parseNumber(row[amountIndex]);
      if (!workerId || !fullName || !payItem) return null;

      const nameParts = splitFullName(fullName);
      const payParts = splitPayItem(payItem);

      return {
        __sourceType: "transactionList",
        Företagsnamn: company,
        "Arbtag.id": workerId,
        "Anst.nr": workerId,
        Förnamn: nameParts.firstName,
        Efternamn: nameParts.lastName,
        Löneart: payParts.code,
        Beskrivning: payParts.description,
        Belopp: amount,
        Konto: accountIndex >= 0 ? cleanText(row[accountIndex]) : "",
        "Kontodel 1": costCenterIndex >= 0 ? cleanText(row[costCenterIndex]) : "",
        "Bokföringsdatum": paymentDate,
        Typ: typeIndex >= 0 ? cleanText(row[typeIndex]) : ""
      };
    })
    .filter(Boolean);
}

export function findTransactionPaymentDate(matrix) {
  for (const row of matrix.slice(0, 8)) {
    for (const cell of row) {
      const text = cleanText(cell);
      const match = text.match(/Utbetalningsdatum\s+(\d{4}-\d{2}-\d{2}|\d{8})/i);
      if (match) return match[1];
    }
  }
  return "";
}

export function findTransactionCompany(matrix, headerIndex) {
  const metadataRows = matrix.slice(0, headerIndex >= 0 ? headerIndex : 8);
  for (const row of metadataRows) {
    for (const cell of row) {
      const text = cleanText(cell);
      const match = text.match(/F[öo]retag\s*[:\-]?\s*(.+)/i);
      if (match && match[1]) return cleanText(match[1]);
    }
  }
  return "";
}
