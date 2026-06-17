// Integrationstest: bygger riktiga xlsx-filer i minnet med samma bibliotek som
// appen använder, läser tillbaka dem och kör dem genom logikmodulerna.
// Täcker binär -> parse-vägen som inte går att testa headless (obscura
// korrumperar binär fetch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTransactionList } from "../src/logic/transactions.js";
import { getSourceType } from "../src/logic/detect.js";
import { resolveColumn, getText, getNumber } from "../src/logic/columns.js";
import { categorizeRow } from "../src/logic/categorize.js";
import { parsePayrollDraftRows } from "../src/logic/payrollDraft.js";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const XLSX = require(join(root, "vendor", "xlsx.full.min.js"));

function toSheetBuffer(aoa) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Blad1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("transaktionslista: riktig xlsx -> parseTransactionList", () => {
  const aoa = [
    ["Företag Testförsamlingen"],
    ["Utbetalningsdatum 2026-05-25"],
    [],
    ["Arbetstagare", "Namn", "Typ", "Löneart", "Konto", "Avvikande kostnadsställe", "Belopp"],
    ["50001", "Anna Andersson", "Lön", "111 - Månadslön", "7010", "", 32000],
    ["50002", "Bengt Hedlund", "Lön", "811 - Preliminärskatt", "2710", "", -9200]
  ];
  const wb = XLSX.read(toSheetBuffer(aoa), { type: "buffer", cellDates: false, raw: true });
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
  const result = parseTransactionList(matrix);
  const rows = result.rows;

  assert.equal(result.sourceType, "transactionList");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["Företagsnamn"], "Testförsamlingen");
  assert.equal(rows[0]["Förnamn"], "Anna");
  assert.equal(rows[0]["Efternamn"], "Andersson");
  assert.equal(rows[0]["Löneart"], "111");
  assert.equal(rows[0]["Beskrivning"], "Månadslön");
  assert.equal(rows[0]["Belopp"], 32000);
  assert.equal(rows[1]["Belopp"], -9200);
});

test("bokföringsposter: riktig xlsx -> objektform, kolumner och kategorisering", () => {
  const aoa = [
    ["Företag", "Företagsnamn", "Bokföringsdatum", "Anst.nr", "Förnamn", "Efternamn", "Löneart", "Beskrivning", "Belopp", "Konto"],
    ["044", "Testförsamlingen", "2026-05-25", "1001", "Anna", "Andersson", "111", "Månadslön", 32000, "7010"],
    ["044", "Testförsamlingen", "2026-05-25", "1001", "Anna", "Andersson", "990", "Arbetsgivaravgift", -10054, "7510"]
  ];
  const wb = XLSX.read(toSheetBuffer(aoa), { type: "buffer", cellDates: false, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Transaktionslist-detektering ska INTE slå till på detta format.
  assert.equal(parseTransactionList(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true })).rows.length, 0);

  const objs = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  assert.equal(objs.length, 2);
  assert.equal(resolveColumn(objs[0], "employeeId"), "Anst.nr");
  assert.equal(getText(objs[0], "firstName"), "Anna");
  assert.equal(getNumber(objs[0], "amount"), 32000);

  const hasBooking = objs.some((r) => getText(r, "bookingDate"));
  const hasAccount = objs.some((r) => getText(r, "account"));
  const hasScope = objs.some((r) => getNumber(r, "scope"));
  assert.equal(getSourceType(hasBooking, hasAccount, hasScope).sourceKey, "accounting");

  assert.equal(categorizeRow(getText(objs[1], "payCode"), getText(objs[1], "description")), "technical");
});

test("löneunderlagslista (Hr+, objektform): riktig xlsx -> payrollDraftHr", () => {
  const aoa = [
    ["Företag", "Företagsnamn", "Anst.nr", "Förnamn", "Efternamn", "Löneart", "Beskrivning", "Belopp", "Omfattning %"],
    ["044", "Testförsamlingen", "1001", "Anna", "Andersson", "111", "Månadslön", 32000, 100]
  ];
  const wb = XLSX.read(toSheetBuffer(aoa), { type: "buffer", cellDates: false, raw: true });
  const objs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });

  const hasBooking = objs.some((r) => getText(r, "bookingDate"));
  const hasAccount = objs.some((r) => getText(r, "account"));
  const hasScope = objs.some((r) => getNumber(r, "scope"));
  assert.equal(getSourceType(hasBooking, hasAccount, hasScope).sourceKey, "payrollDraftHr");
});

test("Löneunderlag från I: riktig xlsx -> payrollDraftI", () => {
  const aoa = [
    ["Företag", "Anst.id", "Arbtag.id", "Förnamn", "Efternamn", "Löneart", "Benämning", "Apris", "Tim/Antal", "Belopp", "Fr.o.m.", "T.o.m.", "Konto", "Textfält 1"],
    ["Testförsamlingen", "1001", "50001", "Anna", "Andersson", "111", "Månadslön", 250, 1, 32000, "2026-05-01", "2026-05-31", "7010", "KST1"]
  ];
  const wb = XLSX.read(toSheetBuffer(aoa), { type: "buffer", cellDates: false, raw: true });
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
  const result = parsePayrollDraftRows(matrix);

  assert.equal(result.sourceType, "payrollDraftI");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]["Anst.nr"], "1001");
  assert.equal(result.rows[0]["Förnamn"], "Anna");
  assert.equal(result.rows[0]["Löneart"], "111");
  assert.equal(result.rows[0]["Belopp"], 32000);
});

test("Löneunderlagslista (Hr+) utan I-nyckelord -> payrollDraftHr", () => {
  const aoa = [
    ["Arbtag.id", "Anst.nr", "Förnamn", "Efternamn", "Löneart", "Benämning", "Belopp", "Fr.o.m.", "T.o.m.", "Omf."],
    ["50001", "1001", "Anna", "Andersson", "111", "Månadslön", 32000, "2026-05-01", "2026-05-31", 100]
  ];
  const wb = XLSX.read(toSheetBuffer(aoa), { type: "buffer", cellDates: false, raw: true });
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
  const result = parsePayrollDraftRows(matrix);

  assert.equal(result.sourceType, "payrollDraftHr");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]["Anst.nr"], "1001");
});
