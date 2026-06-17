// Kolumnmappning mellan HR+-rubriker och interna fältnamn samt uppslag.
import { cleanText, parseNumber } from "./format.js";

export const COLUMN_ALIASES = {
  bookingDate: ["Bokföringsdatum"],
  companyCode: ["Företag"],
  company: ["Företagsnamn"],
  unit: ["Enhet"],
  workerId: ["Arbtag.id"],
  employeeId: ["Anst.nr", "Anst.id"],
  firstName: ["Förnamn", "Namn"],
  lastName: ["Efternamn"],
  agreement: ["Avt/kat", "Avtal"],
  payCode: ["Löneart"],
  description: ["Beskrivning", "Benämning"],
  unitPrice: ["Apris"],
  hours: ["Timmar", "Ant/Tim", "Tim/Antal"],
  calendarDays: ["Kal.dgr", "Kal.dagar"],
  workDays: ["Arb.dgr", "Arb.dagar"],
  amount: ["Belopp"],
  fromDate: ["From-datum", "Fr.o.m."],
  toDate: ["Tom-datum", "T.o.m."],
  scope: ["Omfattning %", "Omf."],
  account: ["Konto"],
  costPart1: ["Kontodel 1"],
  costPart2: ["Kontodel 2"],
  costPart3: ["Kontodel 3"],
  costPart4: ["Kontodel 4"],
  costPart5: ["Kontodel 5"],
  costPart6: ["Kontodel 6"],
  endDate: ["Slutdatum", "Anställd t.o.m."]
};

export const REQUIRED_FIELDS = [
  "employeeId",
  "firstName",
  "lastName",
  "payCode",
  "description",
  "amount"
];

export function resolveColumn(row, field) {
  const aliases = COLUMN_ALIASES[field] || [];
  return aliases.find((name) => Object.prototype.hasOwnProperty.call(row, name)) || "";
}

export function getValue(row, field) {
  const column = resolveColumn(row, field);
  return column ? row[column] : "";
}

export function getText(row, field) {
  return cleanText(getValue(row, field));
}

export function getNumber(row, field) {
  return parseNumber(getValue(row, field));
}
