// Uppdelning av sammanslagna namn- och löneartsfält.
import { cleanText } from "./format.js";

export function splitPayItem(value) {
  const text = cleanText(value);
  const match = text.match(/^(.+?)\s+-\s+(.+)$/);
  if (!match) return { code: text, description: text };
  return {
    code: match[1].trim(),
    description: match[2].trim()
  };
}

export function splitFullName(value) {
  const parts = cleanText(value).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}
