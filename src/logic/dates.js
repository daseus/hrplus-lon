// Sammanfattning av datumspann.

export function summarizeSingleOrSpan(dates) {
  if (!dates.length) return "";
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} - ${dates[dates.length - 1]}`;
}

export function summarizeDateSpan(rows) {
  const dates = rows.flatMap((row) => [row.fromDate, row.toDate]).filter(Boolean).sort();
  return summarizeSingleOrSpan(dates);
}
