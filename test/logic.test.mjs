import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cleanText, parseNumber, formatDate, formatDateRange, formatCurrency,
  formatOptionalCurrency, formatInteger, sum, escapeHtml
} from "../src/logic/format.js";
import { resolveColumn, getValue, getText, getNumber } from "../src/logic/columns.js";
import { splitPayItem, splitFullName } from "../src/logic/names.js";
import { categorizeRow } from "../src/logic/categorize.js";
import { getSourceType } from "../src/logic/detect.js";
import {
  parseTransactionList, findTransactionCompany, findTransactionPaymentDate
} from "../src/logic/transactions.js";
import { summarizeSingleOrSpan, summarizeDateSpan } from "../src/logic/dates.js";
import {
  isPayrollGrossRow, isPayrollNetPayRow, isPayrollSummaryRow, addPayrollReconciliationRows
} from "../src/logic/payroll.js";

test("cleanText trimmar och hanterar null", () => {
  assert.equal(cleanText("  hej  "), "hej");
  assert.equal(cleanText(null), "");
  assert.equal(cleanText(undefined), "");
  assert.equal(cleanText(42), "42");
});

test("parseNumber tolkar svenskt format", () => {
  assert.equal(parseNumber("1 234,56"), 1234.56);
  assert.equal(parseNumber("1.234"), 1234); // punkt = tusentalsavgränsare
  assert.equal(parseNumber("-9 200,00"), -9200);
  assert.equal(parseNumber(1500), 1500);
  assert.equal(parseNumber(""), 0);
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber("abc"), 0);
});

test("parseNumber hanterar även internationellt format", () => {
  assert.equal(parseNumber("1,234.56"), 1234.56); // engelskt: komma=tusental, punkt=decimal
  assert.equal(parseNumber("1.234,56"), 1234.56); // europeiskt: punkt=tusental, komma=decimal
  assert.equal(parseNumber("1 000 000,00"), 1000000);
});

test("formatDate normaliserar datum", () => {
  assert.equal(formatDate("20260525"), "2026-05-25");
  assert.equal(formatDate("2026-05-25T00:00:00"), "2026-05-25");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("ej datum"), "ej datum");
});

test("formatDateRange", () => {
  assert.equal(formatDateRange("2026-05-01", "2026-05-31"), "2026-05-01 - 2026-05-31");
  assert.equal(formatDateRange("2026-05-01", "2026-05-01"), "2026-05-01");
  assert.equal(formatDateRange("2026-05-01", ""), "2026-05-01");
  assert.equal(formatDateRange("", ""), "-");
});

test("escapeHtml saneras", () => {
  assert.equal(escapeHtml('<b>"&\'</b>'), "&lt;b&gt;&quot;&amp;&#039;&lt;/b&gt;");
});

test("sum summerar fält", () => {
  assert.equal(sum([{ a: 1 }, { a: 2 }, { a: "x" }], "a"), 3);
});

test("formatInteger/formatCurrency ger sv-SE-utdata", () => {
  assert.match(formatCurrency(1234.5), /1\s?234,50/);
  assert.equal(formatOptionalCurrency(0), "-");
  assert.match(formatInteger(1000), /1\s?000/);
});

test("kolumnuppslag via alias", () => {
  const row = { "Anst.nr": "1001", "Förnamn": "Anna", "Belopp": "1 000,50" };
  assert.equal(resolveColumn(row, "employeeId"), "Anst.nr");
  assert.equal(getText(row, "firstName"), "Anna");
  assert.equal(getValue(row, "amount"), "1 000,50");
  assert.equal(getNumber(row, "amount"), 1000.5);
  assert.equal(getText(row, "lastName"), "");
});

test("splitPayItem delar kod och beskrivning", () => {
  assert.deepEqual(splitPayItem("111 - Månadslön"), { code: "111", description: "Månadslön" });
  assert.deepEqual(splitPayItem("Endast text"), { code: "Endast text", description: "Endast text" });
});

test("splitFullName delar för- och efternamn", () => {
  assert.deepEqual(splitFullName("Anna Andersson"), { firstName: "Anna", lastName: "Andersson" });
  assert.deepEqual(splitFullName("Anna Maria Andersson"), { firstName: "Anna Maria", lastName: "Andersson" });
  assert.deepEqual(splitFullName("Anna"), { firstName: "Anna", lastName: "" });
  assert.deepEqual(splitFullName(""), { firstName: "", lastName: "" });
});

test("categorizeRow klassificerar lönerader", () => {
  assert.equal(categorizeRow("990", "Arbetsgivaravgift"), "technical");
  assert.equal(categorizeRow("990", "Utbetald nettolön"), "net");
  assert.equal(categorizeRow("811", "Preliminärskatt"), "tax");
  assert.equal(categorizeRow("", "Nettolöneavdrag"), "tax");
  assert.equal(categorizeRow("611", "Sjukfrånvaro karens"), "absence");
  assert.equal(categorizeRow("421", "Bilersättning tjänst"), "reimbursement");
  assert.equal(categorizeRow("111", "Månadslön"), "pay");
  assert.equal(categorizeRow("000", "Något neutralt"), "other");
});

test("getSourceType identifierar exporttyp", () => {
  assert.equal(getSourceType(false, false, false, "transactionList").sourceKey, "transactionList");
  assert.equal(getSourceType(false, false, false, "payrollDraftI").sourceKey, "payrollDraftI");
  assert.equal(getSourceType(false, false, false, "payrollDraftHr").sourceKey, "payrollDraftHr");
  assert.equal(getSourceType(true, true, false).sourceKey, "accounting");
  assert.equal(getSourceType(false, false, true).sourceKey, "payrollDraftHr");
  assert.equal(getSourceType(false, false, false).sourceKey, "unknown");
});

test("findTransactionPaymentDate och findTransactionCompany", () => {
  const matrix = [
    ["Transaktionslista"],
    ["Företag Testförsamlingen"],
    ["Utbetalningsdatum 2026-05-25"],
    [],
    ["Arbetstagare", "Namn", "Löneart", "Belopp"]
  ];
  assert.equal(findTransactionPaymentDate(matrix), "2026-05-25");
  assert.equal(findTransactionCompany(matrix, 4), "Testförsamlingen");
});

test("parseTransactionList parsar och hårdkodar INTE företagsnamn", () => {
  const matrix = [
    ["Företag Testförsamlingen"],
    ["Utbetalningsdatum 2026-05-25"],
    [],
    ["Arbetstagare", "Namn", "Typ", "Löneart", "Konto", "Avvikande kostnadsställe", "Belopp"],
    ["50001", "Anna Andersson", "Lön", "111 - Månadslön", "7010", "", 32000]
  ];
  const result = parseTransactionList(matrix);
  const rows = result.rows;
  assert.equal(result.sourceType, "transactionList");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Företagsnamn"], "Testförsamlingen");
  assert.notEqual(rows[0]["Företagsnamn"], "Lerums församling");
  assert.equal(rows[0]["Förnamn"], "Anna");
  assert.equal(rows[0]["Efternamn"], "Andersson");
  assert.equal(rows[0]["Löneart"], "111");
  assert.equal(rows[0]["Beskrivning"], "Månadslön");
  assert.equal(rows[0]["Belopp"], 32000);
});

test("parseTransactionList ger tom lista för annat format", () => {
  const matrix = [["Anst.nr", "Förnamn", "Efternamn", "Löneart", "Beskrivning", "Belopp"]];
  assert.deepEqual(parseTransactionList(matrix).rows, []);
});

test("payroll-rad-identifiering (brutto/netto/summering)", () => {
  assert.ok(isPayrollGrossRow({ payCode: "bru", description: "Bruttolön" }));
  assert.ok(isPayrollGrossRow({ payCode: "", description: "Brutto" }));
  assert.ok(isPayrollNetPayRow({ payCode: "990", description: "Utbetald nettolön" }));
  assert.ok(isPayrollSummaryRow({ payCode: "brutto", description: "" }));
  assert.ok(!isPayrollSummaryRow({ payCode: "111", description: "Månadslön" }));
});

test("addPayrollReconciliationRows synliggör dolt nettoavdrag", () => {
  const rows = [
    { payCode: "bru", description: "Bruttolön", amount: 30000, category: "pay" },
    { payCode: "", description: "Preliminärskatt", amount: -9000, category: "tax" },
    { payCode: "990", description: "Utbetald nettolön", amount: 18000, category: "net" }
  ];
  const out = addPayrollReconciliationRows(rows, "payrollDraftI");
  assert.equal(out.length, 4);
  const derived = out[out.length - 1];
  assert.equal(derived.amount, -3000);
  assert.equal(derived.category, "tax");
  assert.equal(derived.isDerived, true);
  assert.match(derived.description, /nettoavdrag/i);
});

test("addPayrollReconciliationRows rör inte andra källtyper eller balanserade underlag", () => {
  const rows = [
    { payCode: "bru", description: "Bruttolön", amount: 30000, category: "pay" },
    { payCode: "", description: "Preliminärskatt", amount: -9000, category: "tax" },
    { payCode: "990", description: "Utbetald nettolön", amount: 21000, category: "net" }
  ];
  assert.equal(addPayrollReconciliationRows(rows, "accounting").length, 3);
  assert.equal(addPayrollReconciliationRows(rows, "payrollDraftI").length, 3);
});

test("summarizeDateSpan/summarizeSingleOrSpan", () => {
  assert.equal(summarizeSingleOrSpan([]), "");
  assert.equal(summarizeSingleOrSpan(["2026-05-01"]), "2026-05-01");
  assert.equal(summarizeSingleOrSpan(["2026-05-01", "2026-05-31"]), "2026-05-01 - 2026-05-31");
  assert.equal(
    summarizeDateSpan([{ fromDate: "2026-05-01", toDate: "2026-05-10" }, { fromDate: "2026-05-20", toDate: "2026-05-31" }]),
    "2026-05-01 - 2026-05-31"
  );
});
