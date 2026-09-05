// Parser för löneunderlag: "Löneunderlagslista (Hr+)" och "Löneunderlag från I:".
// Skiljer på undertyperna via I-specifika nyckelord i rubrikraden.
import { cleanText, parseNumber } from "./format.js";

export function parsePayrollDraftRows(matrix) {
  const payrollIKeywords = ["textfält 1", "textfält 2", "tecken", "anst.id"];
  const headerIndex = matrix.findIndex((row) => {
    const labels = row.map((cell) => cleanText(cell).toLowerCase());
    return labels.includes("arbtag.id")
      && labels.includes("löneart")
      && labels.includes("benämning")
      && labels.includes("belopp")
      && labels.includes("fr.o.m.")
      && labels.includes("t.o.m.");
  });
  if (headerIndex === -1) return { sourceType: "", rows: [], warnings: [] };

  const header = matrix[headerIndex].map((value) => cleanText(value).toLowerCase());
  if (header.includes("bokföringsdatum")) {
    return { sourceType: "", rows: [], warnings: [] };
  }

  const isIFile = payrollIKeywords.some((keyword) => header.includes(keyword));
  const payrollSourceType = isIFile ? "payrollDraftI" : "payrollDraftHr";
  const sourceTypeLabel = payrollSourceType === "payrollDraftI" ? "Löneunderlag från I:" : "Löneunderlagslista (Hr+)";

  const employeeIdIndex = header.findIndex((value) => value === "anst.id" || value === "anst.nr");
  if (employeeIdIndex === -1) {
    return {
      sourceType: payrollSourceType,
      rows: [],
      warnings: [`${sourceTypeLabel} hittat men saknar kolumn för Anst.id/Anst.nr.`]
    };
  }

  const workerIdIndex = header.findIndex((value) => value === "arbtag.id");
  const firstNameIndex = header.findIndex((value) => value === "förnamn");
  const lastNameIndex = header.findIndex((value) => value === "efternamn");
  const payCodeIndex = header.findIndex((value) => value === "löneart");
  const descriptionIndex = header.findIndex((value) => value === "benämning");
  const accountIndex = header.findIndex((value) => value === "konto");
  const fromDateIndex = header.findIndex((value) => value === "fr.o.m.");
  const toDateIndex = header.findIndex((value) => value === "t.o.m.");
  const unitPriceIndex = header.findIndex((value) => value === "apris");
  const amountIndex = header.findIndex((value) => value === "belopp");
  const hoursIndex = header.findIndex((value) => value === "tim/antal");
  const calendarDaysIndex = header.findIndex((value) => value === "kal.dagar");
  const workDaysIndex = header.findIndex((value) => value === "arb.dagar");
  const scopeIndex = header.findIndex((value) => value === "omf.");
  const costPart1Index = header.findIndex((value) => value === "textfält 1");
  const costPart2Index = header.findIndex((value) => value === "textfält 2");
  const companyIndex = header.findIndex((value) => value === "företag");
  const unitIndex = header.findIndex((value) => value === "enhet");

  const missing = [
    ["Förnamn", firstNameIndex],
    ["Efternamn", lastNameIndex],
    ["Löneart", payCodeIndex],
    ["Benämning", descriptionIndex],
    ["Belopp", amountIndex]
  ].filter(([, idx]) => idx === -1).map(([name]) => name);

  const warnings = [];
  if (missing.length) {
    warnings.push(`${sourceTypeLabel} hittat men saknar kolumner: ${missing.join(", ")}.`);
    return { sourceType: payrollSourceType, rows: [], warnings };
  }

  if (fromDateIndex === -1 || toDateIndex === -1) warnings.push(`${sourceTypeLabel} saknar periodkolumner (Fr.o.m./T.o.m.).`);

  const rows = matrix.slice(headerIndex + 1)
    .map((row) => {
      const employeeId = cleanText(row[employeeIdIndex]);
      const firstName = cleanText(row[firstNameIndex]);
      const lastName = cleanText(row[lastNameIndex]);
      const payCode = cleanText(row[payCodeIndex]);
      const amount = parseNumber(row[amountIndex]);
      if (!employeeId || !firstName || !lastName || !payCode) return null;

      return {
        __sourceType: payrollSourceType,
        Företag: companyIndex >= 0 ? cleanText(row[companyIndex]) : "",
        Enhet: unitIndex >= 0 ? cleanText(row[unitIndex]) : "",
        "Arbtag.id": cleanText(row[workerIdIndex]),
        "Anst.id": employeeId,
        "Anst.nr": employeeId,
        Förnamn: firstName,
        Efternamn: lastName,
        Löneart: payCode,
        Beskrivning: cleanText(row[descriptionIndex]),
        Apris: unitPriceIndex >= 0 ? row[unitPriceIndex] : "",
        "Tim/Antal": hoursIndex >= 0 ? row[hoursIndex] : "",
        "Kal.dagar": calendarDaysIndex >= 0 ? row[calendarDaysIndex] : "",
        "Arb.dagar": workDaysIndex >= 0 ? row[workDaysIndex] : "",
        "Omf.": scopeIndex >= 0 ? row[scopeIndex] : "",
        Belopp: amount,
        "Fr.o.m.": cleanText(row[fromDateIndex]),
        "T.o.m.": cleanText(row[toDateIndex]),
        Konto: accountIndex >= 0 ? cleanText(row[accountIndex]) : "",
        "Kontodel 1": costPart1Index >= 0 ? cleanText(row[costPart1Index]) : "",
        "Kontodel 2": costPart2Index >= 0 ? cleanText(row[costPart2Index]) : ""
      };
    })
    .filter(Boolean);

  if (!rows.length && missing.length) {
    warnings.push(`Inga giltiga lönerader kunde tolkas för ${sourceTypeLabel}.`);
  }

  return { sourceType: payrollSourceType, rows, warnings };
}
