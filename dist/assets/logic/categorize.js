// Kategorisering av lönerader och sektionsordning.

export const SECTION_ORDER = [
  "pay",
  "absence",
  "reimbursement",
  "tax",
  "net",
  "other",
  "technical"
];

export const SECTION_LABELS = {
  pay: "Lön/arvoden",
  absence: "Frånvaro/semester",
  reimbursement: "Ers./utlägg",
  tax: "Skatt/avdrag",
  net: "Nettolön",
  other: "Övrigt",
  technical: "Tekn./bokf."
};

export const TECHNICAL_PATTERNS = [
  /arbetsgivaravgift/i,
  /ag\.?avgift/i,
  /trygghetsfonden/i,
  /kpa/i,
  /tfa/i,
  /tpa/i,
  /riskförsäkring/i,
  /premiebef/i,
  /pension/i,
  /löneskatt/i,
  /skuld/i,
  /förändr\./i,
  /generellt påslag/i,
  /extra avsättning/i
];

export function categorizeRow(payCode, description, sourceType = "") {
  const text = `${payCode} ${description}`;
  if (sourceType === "accounting" && TECHNICAL_PATTERNS.some((pattern) => pattern.test(text))) return "technical";
  if (/utbetald\s*nett[oö]lön|^990\b/i.test(text)) return "net";
  if (/sjuk|karens|semester|komp|frånvaro|föräldra|vab|ledighet|sparad/i.test(text)) return "absence";
  if (/skatt|utmätning|nettolöneavdrag|löneavdrag|öresutjämning/i.test(text)) return "tax";
  if (/utlägg|ersättning|bilersättning|km-ers|rese|traktamente|milersättning/i.test(text)) return "reimbursement";
  if (/lön|arvode|ob-|ob |övertid|beredskap|jour|tillägg|timlön|månadslön/i.test(text)) return "pay";
  return "other";
}
