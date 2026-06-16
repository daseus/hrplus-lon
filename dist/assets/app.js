import { cleanText, parseNumber, formatDate, formatDateRange, formatCurrency, formatOptionalCurrency, formatDecimal, formatInteger, sum, escapeHtml } from "./logic/format.js";
import { COLUMN_ALIASES, REQUIRED_FIELDS, resolveColumn, getValue, getText, getNumber } from "./logic/columns.js";
import { splitPayItem, splitFullName } from "./logic/names.js";
import { SECTION_ORDER, SECTION_LABELS, TECHNICAL_PATTERNS, categorizeRow } from "./logic/categorize.js";
import { getSourceType } from "./logic/detect.js";
import { parseTransactionList, findTransactionPaymentDate, findTransactionCompany } from "./logic/transactions.js";
import { summarizeSingleOrSpan, summarizeDateSpan } from "./logic/dates.js";

const APP_INFO = {
  name: "Löneunderlagsgranskare HR+",
  version: "1.0",
  author: "David Campbell",
  contact: "david.campbell@svenskakyrkan.se"
};

const state = {
  employees: [],
  rows: [],
  selectedKey: null,
  viewMode: "single",
  sortBy: "name",
  showTechnical: false,
  mergeSplits: true,
  onlyWithRows: true,
  query: "",
  metadata: null
};

// "Visa alla" renderar varje rapport lazy först när den närmar sig vyn.
// Under tröskeln renderas allt direkt (oförändrat beteende, Ctrl+F träffar allt).
const ALL_VIEW_LAZY_THRESHOLD = 40;
let allViewObserver = null;
let allViewSlots = [];

const els = {
  fileInput: document.getElementById("fileInput"),
  searchInput: document.getElementById("searchInput"),
  showTechnicalInput: document.getElementById("showTechnicalInput"),
  mergeSplitsInput: document.getElementById("mergeSplitsInput"),
  onlyWithRowsInput: document.getElementById("onlyWithRowsInput"),
  status: document.getElementById("status"),
  employeeList: document.getElementById("employeeList"),
  main: document.getElementById("main"),
  companyMetric: document.getElementById("companyMetric"),
  sourceMetric: document.getElementById("sourceMetric"),
  periodMetric: document.getElementById("periodMetric"),
  peopleMetric: document.getElementById("peopleMetric"),
  printButton: document.getElementById("printButton"),
  printAllButton: document.getElementById("printAllButton"),
  singleViewButton: document.getElementById("singleViewButton"),
  allViewButton: document.getElementById("allViewButton"),
  sortSelect: document.getElementById("sortSelect"),
  previousButton: document.getElementById("previousButton"),
  nextButton: document.getElementById("nextButton"),
  pagerStatus: document.getElementById("pagerStatus"),
  helpButton: document.getElementById("helpButton"),
  helpDialog: document.getElementById("helpDialog"),
  closeHelpButton: document.getElementById("closeHelpButton"),
  aboutText: document.getElementById("aboutText"),
  contactText: document.getElementById("contactText"),
  buildInfo: document.getElementById("buildInfo"),
};

els.fileInput.addEventListener("change", handleFileChange);
els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value.trim().toLowerCase();
  render();
});
els.showTechnicalInput.addEventListener("change", () => {
  state.showTechnical = els.showTechnicalInput.checked;
  render();
});
els.mergeSplitsInput.addEventListener("change", () => {
  state.mergeSplits = els.mergeSplitsInput.checked;
  render();
});
els.onlyWithRowsInput.addEventListener("change", () => {
  state.onlyWithRows = els.onlyWithRowsInput.checked;
  render();
});
els.printButton.addEventListener("click", () => window.print());
els.printAllButton.addEventListener("click", printAll);
window.addEventListener("beforeprint", renderAllReportSlots);
els.singleViewButton.addEventListener("click", () => {
  state.viewMode = "single";
  render();
});
els.allViewButton.addEventListener("click", () => {
  state.viewMode = "all";
  render();
});
els.sortSelect.addEventListener("change", () => {
  state.sortBy = els.sortSelect.value;
  render();
});
els.previousButton.addEventListener("click", () => selectRelativeEmployee(-1));
els.nextButton.addEventListener("click", () => selectRelativeEmployee(1));
els.helpButton.addEventListener("click", openHelp);
els.closeHelpButton.addEventListener("click", closeHelp);
els.helpDialog.addEventListener("click", (event) => {
  if (event.target === els.helpDialog) closeHelp();
});

// Drag-and-drop: släpp en xlsx var som helst på sidan för att importera.
["dragenter", "dragover"].forEach((type) => {
  document.addEventListener(type, (event) => {
    if (event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault();
      document.body.classList.add("dragging");
    }
  });
});
["dragleave", "dragend"].forEach((type) => {
  document.addEventListener(type, (event) => {
    if (!event.relatedTarget) document.body.classList.remove("dragging");
  });
});
document.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) return;
  event.preventDefault();
  document.body.classList.remove("dragging");
  importFile(file);
});

// Tangentbordsnavigering: j/k bläddrar mellan anställda.
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = (event.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || event.target.isContentEditable) return;
  if (!state.employees.length) return;
  if (event.key === "j") {
    event.preventDefault();
    selectRelativeEmployee(1);
  } else if (event.key === "k") {
    event.preventDefault();
    selectRelativeEmployee(-1);
  }
});

initializeStaticText();

function handleFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (file) importFile(file);
}

async function importFile(file) {
  if (!file) return;

  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    setStatus("Välj en Excel-fil med ändelsen .xlsx eller .xls.", true);
    return;
  }

  setStatus("Läser filen...");

  try {
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/xlsx.full.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Kunde inte ladda biblioteket för Excel-läsning."));
        document.head.appendChild(script);
      });
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Filen innehåller inget kalkylblad.");

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = extractRowsFromSheet(sheet);
    if (!rawRows.length) throw new Error("Kalkylbladet innehåller inga datarader.");

    validateColumns(rawRows[0]);
    loadRows(rawRows);
    setStatus(buildImportSummary(file.name, rawRows.length), state.metadata && state.metadata.sourceKey === "unknown");
  } catch (error) {
    resetData();
    setStatus(error.message || "Kunde inte läsa filen.", true);
  }
}

function extractRowsFromSheet(sheet) {
  const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const transactionRows = parseTransactionList(matrix);
  if (transactionRows.length) return transactionRows;
  return window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
}

function validateColumns(firstRow) {
  const missing = REQUIRED_FIELDS
    .filter((field) => !resolveColumn(firstRow, field))
    .map((field) => COLUMN_ALIASES[field][0]);
  if (missing.length) {
    throw new Error(`Saknar förväntade kolumner eller motsvarande fält: ${missing.join(", ")}.`);
  }
}

function loadRows(rawRows) {
  const rows = rawRows.map(normalizeRow).filter((row) => row.employeeName && row.description);
  const employeesByKey = new Map();

  for (const row of rows) {
    if (!employeesByKey.has(row.employeeKey)) {
      employeesByKey.set(row.employeeKey, {
        key: row.employeeKey,
        employeeId: row.employeeId,
        workerId: row.workerId,
        firstName: row.firstName,
        lastName: row.lastName,
        name: row.employeeName,
        rows: [],
        searchText: ""
      });
    }
    employeesByKey.get(row.employeeKey).rows.push(row);
  }

  const employees = Array.from(employeesByKey.values());

  for (const employee of employees) {
    employee.searchText = [
      employee.name,
      employee.employeeId,
      employee.workerId,
      ...employee.rows.map((row) => `${row.payCode} ${row.description}`)
    ].join(" ").toLowerCase();
  }

  state.rows = rows;
  state.employees = employees;
  state.selectedKey = getDisplayEmployees()[0] ? getDisplayEmployees()[0].key : null;
  state.metadata = getMetadata(rows);
  enableControls(true);
  updateMetrics();
  render();
}

function buildImportSummary(fileName, rawRowCount) {
  const meta = state.metadata;
  const typeText = meta && meta.sourceLabel ? ` som ${meta.sourceLabel}` : "";
  const skipped = rawRowCount - state.rows.length;
  let message = `Importerade ${formatInteger(state.rows.length)} rader (${formatInteger(state.employees.length)} anställda)${typeText} från ${fileName}.`;
  if (skipped > 0) {
    message += ` ${formatInteger(skipped)} rader utan namn/benämning hoppades över.`;
  }
  if (meta && meta.sourceKey === "unknown") {
    message += " Obs: exporttypen kunde inte identifieras säkert - kontrollera att filen kommer från Hr+.";
  }
  return message;
}

function normalizeRow(raw) {
  const firstName = getText(raw, "firstName");
  const lastName = getText(raw, "lastName");
  const employeeId = getText(raw, "employeeId");
  const workerId = getText(raw, "workerId");
  const description = getText(raw, "description");
  const payCode = getText(raw, "payCode");
  const amount = getNumber(raw, "amount");
  const category = categorizeRow(payCode, description);

  return {
    original: raw,
    company: getText(raw, "company"),
    companyCode: getText(raw, "companyCode"),
    bookingDate: formatDate(getValue(raw, "bookingDate")),
    unit: getText(raw, "unit"),
    employeeId,
    workerId,
    firstName,
    lastName,
    employeeName: `${firstName} ${lastName}`.trim(),
    employeeKey: `${workerId || employeeId}|${firstName}|${lastName}`,
    agreement: getText(raw, "agreement"),
    payCode,
    description,
    unitPrice: getNumber(raw, "unitPrice"),
    hours: getNumber(raw, "hours"),
    calendarDays: getNumber(raw, "calendarDays"),
    workDays: getNumber(raw, "workDays"),
    amount,
    fromDate: formatDate(getValue(raw, "fromDate")),
    toDate: formatDate(getValue(raw, "toDate")),
    scope: getNumber(raw, "scope"),
    account: getText(raw, "account"),
    costParts: [
      getValue(raw, "costPart1"),
      getValue(raw, "costPart2"),
      getValue(raw, "costPart3"),
      getValue(raw, "costPart4"),
      getValue(raw, "costPart5"),
      getValue(raw, "costPart6")
    ].map(cleanText).filter(Boolean),
    endDate: formatDate(getValue(raw, "endDate")),
    category,
    isTechnical: category === "technical"
  };
}

function getMetadata(rows) {
  const first = rows[0] || {};
  const bookingDates = [...new Set(rows.map((row) => row.bookingDate).filter(Boolean))];
  const payrollRows = rows.filter((row) => !row.isTechnical);
  const reportDate = summarizeSingleOrSpan(bookingDates);
  const period = summarizeDateSpan(payrollRows.length ? payrollRows : rows);
  const hasBookingDate = bookingDates.length > 0;
  const hasAccount = rows.some((row) => row.account);
  const hasScope = rows.some((row) => row.scope);
  const sourceType = getSourceType(hasBookingDate, hasAccount, hasScope, first.original && first.original.__sourceType);
  return {
    company: first.company || first.companyCode || "-",
    reportDate: reportDate || "-",
    period: period || "-",
    ...sourceType
  };
}

function render() {
  renderEmployeeList();
  renderMainView();
  updateMetrics();
  updateControlState();
}

function renderEmployeeList() {
  const employees = getDisplayEmployees();
  els.employeeList.innerHTML = "";

  if (!state.employees.length) return;

  if (!employees.length) {
    els.employeeList.innerHTML = `<div class="status">Ingen anställd matchar filtret.</div>`;
    return;
  }

  if (!employees.some((employee) => employee.key === state.selectedKey)) {
    state.selectedKey = employees[0].key;
  }

  const fragment = document.createDocumentFragment();
  for (const employee of employees) {
    const visibleRows = getReportRows(employee);
    const listTotal = getEmployeeListTotal(visibleRows);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `employee-button${employee.key === state.selectedKey ? " active" : ""}`;
    button.addEventListener("click", () => {
      state.selectedKey = employee.key;
      state.viewMode = "single";
      render();
      els.main.scrollTop = 0;
    });
    button.innerHTML = `
      <span class="employee-info">
        <span class="employee-name">${escapeHtml(employee.name)}</span>
        <span class="employee-meta">Anst.nr ${escapeHtml(employee.employeeId || "-")}</span>
        <span class="employee-meta">${visibleRows.length}/${employee.rows.length} rader</span>
      </span>
      <span class="employee-total" title="${escapeHtml(listTotal.label)}">${formatCurrency(listTotal.amount)}</span>
    `;
    fragment.appendChild(button);
  }
  els.employeeList.appendChild(fragment);
}

function renderSelectedEmployee() {
  const employee = state.employees.find((item) => item.key === state.selectedKey);
  if (!employee) {
    els.main.innerHTML = `
      <section class="empty-state">
        <h2>Ingen fil importerad</h2>
        <p>Välj eller släpp Excel-exporten från Hr+ här. All bearbetning sker lokalt i webbläsaren.</p>
      </section>
    `;
    els.printButton.disabled = true;
    return;
  }

  const visibleRows = getReportRows(employee);

  els.printButton.disabled = false;
  els.printAllButton.disabled = visibleRows.length === 0;

  els.main.innerHTML = `
    ${renderPrintHeader("Vald person")}
    ${renderSourceNotice()}
    ${renderReportToolbar("Vald person", "Bläddra med pilarna eller välj en person i listan.")}
    ${renderEmployeeReport(employee)}
  `;
}

function renderMainView() {
  if (state.viewMode === "all") {
    renderAllEmployees();
  } else {
    renderSelectedEmployee();
  }
}

function renderAllEmployees() {
  const employees = getDisplayEmployees();
  if (!state.employees.length) {
    renderSelectedEmployee();
    return;
  }

  if (allViewObserver) {
    allViewObserver.disconnect();
    allViewObserver = null;
  }
  allViewSlots = [];

  if (!employees.length) {
    els.main.innerHTML = `
      <section class="empty-state">
        <h2>Inga matchande anställda</h2>
        <p>Justera sökningen eller visa även anställda utan synliga rader.</p>
      </section>
    `;
    return;
  }

  els.printButton.disabled = false;
  els.printAllButton.disabled = false;

  const visibleRows = employees.flatMap((employee) => getReportRows(employee));
  const totalRows = employees.reduce((count, employee) => count + employee.rows.length, 0);

  const head = `
    ${renderPrintHeader(state.metadata ? state.metadata.sourceLabel : "Löneunderlagslista")}
    ${renderSourceNotice()}
    ${renderReportToolbar(
      "Alla anställda",
      `${employees.length} anställda · ${visibleRows.length} synliga rader · ${totalRows} totalrader`
    )}
  `;

  if (employees.length <= ALL_VIEW_LAZY_THRESHOLD) {
    els.main.innerHTML = `${head}${employees.map((employee) => renderEmployeeReport(employee, true)).join("")}`;
    return;
  }

  els.main.innerHTML = `${head}<div id="allReports"></div>`;
  const container = document.getElementById("allReports");
  const fragment = document.createDocumentFragment();
  allViewSlots = [];
  for (const employee of employees) {
    const slot = document.createElement("div");
    slot.className = "report-slot";
    slot.style.minHeight = `${estimateReportHeight(employee)}px`;
    slot._employee = employee;
    fragment.appendChild(slot);
    allViewSlots.push(slot);
  }
  container.appendChild(fragment);

  allViewObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        fillReportSlot(entry.target);
        observer.unobserve(entry.target);
      }
    }
  }, { root: els.main, rootMargin: "800px 0px" });

  for (const slot of allViewSlots) {
    allViewObserver.observe(slot);
  }
}

function estimateReportHeight(employee) {
  return 220 + getReportRows(employee).length * 30;
}

function fillReportSlot(slot) {
  if (!slot || slot.dataset.filled === "true" || !slot._employee) return;
  slot.innerHTML = renderEmployeeReport(slot._employee, true);
  slot.style.minHeight = "";
  slot.dataset.filled = "true";
}

// Utskrift kräver att alla rapporter finns i DOM:en. Fyll därför kvarvarande
// slots innan print (knapp, Ctrl+P och beforeprint-eventet).
function renderAllReportSlots() {
  if (allViewObserver) {
    allViewObserver.disconnect();
    allViewObserver = null;
  }
  for (const slot of allViewSlots) {
    fillReportSlot(slot);
  }
}

function renderPrintHeader(title) {
  const dateMeta = state.metadata && ["accounting", "transactionList"].includes(state.metadata.sourceKey)
    ? `<div>${escapeHtml(state.metadata.dateLabel)}: ${escapeHtml(state.metadata.reportDate)}</div>`
    : "";
  const periodMeta = !state.metadata || !["accounting", "transactionList"].includes(state.metadata.sourceKey)
    ? `<div>Period: ${escapeHtml(state.metadata ? state.metadata.period : "-")}</div>`
    : "";
  return `
    <div class="print-report-header">
      <div class="print-company">${escapeHtml(state.metadata ? state.metadata.company : "")}</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="print-meta">
        <div>Underlag: ${escapeHtml(state.metadata ? state.metadata.sourceLabel : "-")}</div>
        ${periodMeta}
        ${dateMeta}
      </div>
    </div>
  `;
}

function renderSourceNotice() {
  if (!state.metadata) return "";
  if (state.metadata.sourceKey === "payrollList") {
    return `
      <div class="source-notice warning">
        <strong>${escapeHtml(state.metadata.sourceLabel)}:</strong>
        Obs! Ej komplett löneunderlag. Visar registrerade lönepåverkande poster och beräkningsunderlag för perioden
        <strong>${escapeHtml(state.metadata.period)}</strong>.
        Komplett löneunderlagslista hämtas från Ekonomirutin &gt; Bokföringsposter när underlaget är klart för månaden.
      </div>
    `;
  }
  const dateText = ["accounting", "transactionList"].includes(state.metadata.sourceKey)
    ? `${state.metadata.dateLabel}: ${state.metadata.reportDate}`
    : "Bokföringsdatum saknas";
  const periodText = ["accounting", "transactionList"].includes(state.metadata.sourceKey)
    ? ""
    : `Period: <strong>${escapeHtml(state.metadata.period)}</strong>.`;
  return `
    <div class="source-notice ${state.metadata.sourceTone === "warning" ? "warning" : ""}">
      <strong>${escapeHtml(state.metadata.sourceLabel)}.</strong>
      ${escapeHtml(state.metadata.sourceDescription)}
      ${periodText}
      ${escapeHtml(dateText)}.
    </div>
  `;
}

function renderReportToolbar(title, detail) {
  return `
    <div class="report-toolbar">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
      <div class="actions">
        <span class="tag">${state.showTechnical ? "Alla rader" : "Tekniska rader dolda"}</span>
      </div>
    </div>
  `;
}

function renderEmployeeReport(employee, isAllReport = false) {
  const visibleRows = getReportRows(employee);
  const sections = groupRowsBySection(visibleRows);
  const totals = getSummaryTotals(employee, visibleRows);
  const summaryBoxes = getSummaryBoxes(totals);

  return `
    <article class="person-report${isAllReport ? " all-report" : ""}">
      <div class="person-header">
        <div class="person-title">
          <h2>${escapeHtml(employee.name)}</h2>
          <p>Anst.nr ${escapeHtml(employee.employeeId || "-")} · Arbtag.id ${escapeHtml(employee.workerId || "-")} · ${visibleRows.length}/${getVisibleRows(employee).length} rader</p>
        </div>
      </div>

      <div class="summary-grid">
        ${summaryBoxes.map((box) => renderSummaryBox(box.label, box.amount)).join("")}
      </div>

      ${SECTION_ORDER.map((sectionKey) => renderSection(sectionKey, sections[sectionKey] || [])).join("")}
    </article>
  `;
}

function renderSummaryBox(label, amount) {
  return `
    <div class="summary-box">
      <span class="label">${escapeHtml(label)}</span>
      <span class="amount">${formatCurrency(amount)}</span>
    </div>
  `;
}

function getSummaryBoxes(totals) {
  const sourceKey = state.metadata ? state.metadata.sourceKey : "";
  if (sourceKey === "payrollList") {
    return [
      { label: "Summa poster", amount: totals.visible },
      { label: "Lön/arvoden", amount: totals.pay },
      { label: "Ers./utlägg", amount: totals.reimbursement },
      { label: "Frånvaro/sem.", amount: totals.absence }
    ];
  }

  if (sourceKey === "transactionList" || sourceKey === "accounting") {
    return [
      { label: "Brutto", amount: totals.gross },
      { label: "Ers./utlägg", amount: totals.reimbursement },
      { label: "Skatt/avdrag", amount: totals.tax },
      { label: "Nettolön", amount: totals.netPay }
    ];
  }

  return [
    { label: "Summa poster", amount: totals.visible },
    { label: "Brutto", amount: totals.pay },
    { label: "Ers./utlägg", amount: totals.reimbursement },
    { label: "Skatt/avdrag", amount: totals.tax },
    { label: "Nettolön", amount: totals.netPay }
  ];
}

function renderSection(sectionKey, rows) {
  if (sectionKey === "technical" && !state.showTechnical) return "";
  if (!rows.length) return "";

  const total = sum(rows, "amount");
  return `
    <section class="section">
      <div class="section-heading">
        <h3>${SECTION_LABELS[sectionKey]}</h3>
        <span class="section-total">${rows.length} rader · ${formatCurrency(total)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-code">Löneart</th>
              <th class="col-account">Konto</th>
              <th class="col-date">Datum</th>
              <th class="col-scope number">Omf</th>
              <th class="col-qty number">Antal</th>
              <th class="col-price number">À-pris</th>
              <th class="col-amount number">Belopp</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRow(row) {
  return `
    <tr>
      <td>${escapeHtml(formatDescription(row))}</td>
      <td>${escapeHtml(formatAccount(row))}</td>
      <td>${escapeHtml(formatDateRange(row.fromDate, row.toDate))}</td>
      <td class="number">${escapeHtml(formatScope(row))}</td>
      <td class="number">${escapeHtml(formatQuantity(row))}</td>
      <td class="number">${formatOptionalCurrency(row.unitPrice)}</td>
      <td class="amount-cell ${row.amount < 0 ? "negative" : ""}">${formatCurrency(row.amount)}</td>
    </tr>
  `;
}

function groupRowsBySection(rows) {
  return rows.reduce((groups, row) => {
    const key = row.category || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
    return groups;
  }, {});
}

function getSummaryTotals(employee, visibleRows) {
  const pay = sum(visibleRows.filter((row) => row.category === "pay"), "amount");
  const absence = sum(visibleRows.filter((row) => row.category === "absence"), "amount");
  const reimbursement = sum(visibleRows.filter((row) => row.category === "reimbursement"), "amount");
  const other = sum(visibleRows.filter((row) => row.category === "other"), "amount");
  const tax = sum(visibleRows.filter((row) => row.category === "tax"), "amount");
  const netPay = Math.abs(sum(visibleRows.filter((row) => row.category === "net"), "amount"));
  return {
    visible: sum(visibleRows, "amount"),
    gross: pay + absence + reimbursement + other,
    pay,
    absence,
    reimbursement,
    other,
    tax,
    netPay
  };
}

function getEmployeeListTotal(visibleRows) {
  const totals = getSummaryTotals(null, visibleRows);
  const sourceKey = state.metadata ? state.metadata.sourceKey : "";
  if ((sourceKey === "transactionList" || sourceKey === "accounting") && totals.netPay) {
    return { label: "Nettolön/utbetalt", amount: totals.netPay };
  }
  if (sourceKey === "payrollList") {
    return { label: "Summa synliga lönepåverkande poster", amount: totals.visible };
  }
  return { label: "Summa synliga poster", amount: totals.visible };
}

function getFilteredEmployees() {
  return state.employees.filter((employee) => {
    if (state.query && !employee.searchText.includes(state.query)) return false;
    if (state.onlyWithRows && getVisibleRows(employee).length === 0) return false;
    return true;
  });
}

function getDisplayEmployees() {
  return [...getFilteredEmployees()].sort(compareEmployees);
}

function compareEmployees(a, b) {
  if (state.sortBy === "employeeId") {
    return compareNatural(a.employeeId, b.employeeId) || compareNatural(a.name, b.name);
  }
  if (state.sortBy === "workerId") {
    return compareNatural(a.workerId, b.workerId) || compareNatural(a.name, b.name);
  }
  return compareNatural(a.lastName, b.lastName) || compareNatural(a.firstName, b.firstName) || compareNatural(a.employeeId, b.employeeId);
}

function compareNatural(a, b) {
  return String(a || "").localeCompare(String(b || ""), "sv", {
    numeric: true,
    sensitivity: "base"
  });
}

function selectRelativeEmployee(direction) {
  const employees = getDisplayEmployees();
  if (!employees.length) return;
  const currentIndex = employees.findIndex((employee) => employee.key === state.selectedKey);
  const fallbackIndex = direction > 0 ? -1 : 0;
  const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex) + direction;
  const wrappedIndex = (nextIndex + employees.length) % employees.length;
  state.selectedKey = employees[wrappedIndex].key;
  state.viewMode = "single";
  render();
}

function updateControlState() {
  const enabled = state.employees.length > 0;
  const employees = getDisplayEmployees();
  const selectedIndex = employees.findIndex((employee) => employee.key === state.selectedKey);

  els.singleViewButton.classList.toggle("active", state.viewMode === "single");
  els.allViewButton.classList.toggle("active", state.viewMode === "all");
  els.sortSelect.value = state.sortBy;
  els.mergeSplitsInput.checked = state.mergeSplits;
  const hasTechnicalRows = state.rows.some((row) => row.isTechnical);
  if (!hasTechnicalRows) {
    state.showTechnical = false;
    els.showTechnicalInput.checked = false;
  }
  els.showTechnicalInput.disabled = !enabled || !hasTechnicalRows;
  els.showTechnicalInput.parentElement.title = hasTechnicalRows
    ? "Visar eller döljer arbetsgivaravgifter, pensions-/försäkringsrader och andra bokföringsrader."
    : "Den importerade filen innehåller inga tekniska/bokföringsrader att visa.";
  els.pagerStatus.textContent = employees.length
    ? `${selectedIndex + 1 || 1} av ${employees.length}`
    : "0 av 0";

  els.previousButton.disabled = !enabled || employees.length < 2;
  els.nextButton.disabled = !enabled || employees.length < 2;
  els.printAllButton.disabled = !enabled;
}

function getVisibleRows(employee) {
  const rows = state.showTechnical ? employee.rows : employee.rows.filter((row) => !row.isTechnical);
  return rows;
}

function getReportRows(employee) {
  const rows = getVisibleRows(employee);
  return state.mergeSplits ? mergeCostSplitRows(rows) : rows;
}

function mergeCostSplitRows(rows) {
  const groups = new Map();

  for (const [index, row] of rows.entries()) {
    const key = row.isTechnical ? `technical|${index}` : [
      row.category,
      row.payCode,
      row.description,
      row.fromDate,
      row.toDate,
      row.account,
      row.unitPrice
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        ...row,
        hours: 0,
        amount: 0,
        sourceRows: [],
        mergedCostParts: new Set(),
        mergedCalendarDays: new Set(),
        mergedWorkDays: new Set()
      });
    }

    const merged = groups.get(key);
    merged.hours += row.hours || 0;
    merged.amount += row.amount || 0;
    merged.sourceRows.push(row);
    if (!merged.fromDate || compareNatural(row.fromDate, merged.fromDate) < 0) merged.fromDate = row.fromDate;
    if (!merged.toDate || compareNatural(row.toDate, merged.toDate) > 0) merged.toDate = row.toDate;
    if (row.calendarDays) merged.mergedCalendarDays.add(row.calendarDays);
    if (row.workDays) merged.mergedWorkDays.add(row.workDays);
    for (const part of row.costParts) merged.mergedCostParts.add(part);
  }

  return Array.from(groups.values()).map((row) => {
    const calendarDays = row.mergedCalendarDays.size === 1
      ? Array.from(row.mergedCalendarDays)[0]
      : row.sourceRows.reduce((total, source) => total + (source.calendarDays || 0), 0);
    const workDays = row.mergedWorkDays.size === 1
      ? Array.from(row.mergedWorkDays)[0]
      : row.sourceRows.reduce((total, source) => total + (source.workDays || 0), 0);
    const costParts = Array.from(row.mergedCostParts);

    return {
      ...row,
      calendarDays,
      workDays,
      costParts,
      isMerged: row.sourceRows.length > 1,
      mergedCount: row.sourceRows.length
    };
  });
}

function updateMetrics() {
  els.companyMetric.textContent = state.metadata ? state.metadata.company : "-";
  els.sourceMetric.textContent = state.metadata ? state.metadata.sourceShortLabel : "-";
  els.sourceMetric.title = state.metadata ? state.metadata.sourceLabel : "";
  els.periodMetric.textContent = state.metadata ? state.metadata.period : "-";
  els.peopleMetric.textContent = formatInteger(state.employees.length);
}

function printAll() {
  state.viewMode = "all";
  render();
  renderAllReportSlots();
  setTimeout(() => window.print(), 50);
}

function initializeStaticText() {
  els.aboutText.textContent = `${APP_INFO.name} version ${APP_INFO.version}. Programmet är framtaget av ${APP_INFO.author}.`;
  els.contactText.textContent = APP_INFO.contact;
  loadBuildInfo();
}

// Visar repo/branch/commit för den körande imagen (version.json bakas in vid
// bygget). Saknas filen, t.ex. vid lokal fil utan bygginfo, visas inget.
async function loadBuildInfo() {
  try {
    const res = await fetch("version.json", { cache: "no-store" });
    if (!res.ok) return;
    const v = await res.json();
    els.buildInfo.textContent = "";
    const add = (label, value, href) => {
      if (!value) return;
      if (els.buildInfo.childNodes.length) els.buildInfo.append(" · ");
      els.buildInfo.append(`${label}: `);
      if (href) {
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = value;
        els.buildInfo.append(a);
      } else {
        els.buildInfo.append(value);
      }
    };
    const repoHref = /^https?:/.test(v.repo || "") ? v.repo : "";
    add("Repo", v.repo, repoHref);
    add("Branch", v.branch);
    add("Commit", v.commit, v.commitUrl);
    add("Byggd", v.builtAt);
  } catch (error) {
    console.debug("Ingen version.json att visa", error);
  }
}

function openHelp() {
  if (typeof els.helpDialog.showModal === "function") {
    els.helpDialog.showModal();
  } else {
    alert(`${APP_INFO.name}\n\nBokförd löneunderlagslista: Ekonomirutin > Bokföringsposter > Mer > Export > Kalkylprogram.\nLönepåverkande poster för period: Ekonomirutin > Löneunderlagslista > Mer > Export > Kalkylprogram.\n\nKontakt: ${APP_INFO.contact}`);
  }
}

function closeHelp() {
  if (els.helpDialog.open) els.helpDialog.close();
}

function resetData() {
  state.employees = [];
  state.rows = [];
  state.selectedKey = null;
  state.viewMode = "single";
  state.mergeSplits = true;
  state.metadata = null;
  enableControls(false);
  updateMetrics();
  render();
}

function enableControls(enabled) {
  els.searchInput.disabled = !enabled;
  els.showTechnicalInput.disabled = !enabled;
  els.mergeSplitsInput.disabled = !enabled;
  els.onlyWithRowsInput.disabled = !enabled;
  els.printButton.disabled = !enabled;
  els.singleViewButton.disabled = !enabled;
  els.allViewButton.disabled = !enabled;
  els.sortSelect.disabled = !enabled;
  els.previousButton.disabled = !enabled;
  els.nextButton.disabled = !enabled;
  els.printAllButton.disabled = !enabled;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function formatQuantity(row) {
  if (row.hours) return formatDecimal(row.hours);
  if (row.workDays) return formatDecimal(row.workDays);
  if (row.calendarDays) return formatDecimal(row.calendarDays);
  return "-";
}

function formatScope(row) {
  if (row.scope) return formatDecimal(row.scope);
  if (row.workDays || row.calendarDays) return "100,00";
  return "";
}

function formatDescription(row) {
  const description = formatPayrollDescription(row);
  return `${row.payCode || "-"} ${description}`;
}

function formatPayrollDescription(row) {
  const description = row.description || "-";
  const replacements = [
    [/^Sjuk dag\s+1$/i, "Sjukavdr. dag 1"],
    [/^Sjuk dag\s+2-14$/i, "Sjukavdr. dag 2-14"],
    [/^Sjuk dag\s+15-90$/i, "Sjukavdr. dag 15-90"],
    [/^Sjuk dag\s+91-364$/i, "Sjukavdr. dag 91-364"],
    [/^Sjuk dag/i, "Sjukavdr. dag"],
    [/^Sjuklön 80%$/i, "Sjuklön 80%"],
    [/^Karensavdrag$/i, "Karensavdr."],
    [/^Preliminärskatt$/i, "Prel.skatt"],
    [/^Öresutjämning$/i, "Öresutj."],
    [/^Semesterersättning$/i, "Sem.ersättn."],
    [/^Semesteravdrag$/i, "Sem.avdrag"],
    [/^Semestertillägg/i, "Sem.tillägg"],
    [/^Månadslön$/i, "Månadslön"],
    [/^Timlön$/i, "Timlön"],
    [/^Bilersättning skattefri$/i, "Bilers. skfr"],
    [/^Bilersättning skattepliktig$/i, "Bilers. skpl"],
    [/^Km-ers skfr$/i, "Km-ers. skfr"],
    [/^Km-ers skpl$/i, "Km-ers. skpl"]
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(description)) return description.replace(pattern, replacement);
  }

  return description
    .replace(/^Arvode uppdragstagare$/i, "Arvode uppdrag")
    .replace(/^Periodens närvarotid$/i, "Närvarotid")
    .replace(/^Föräldraledighet$/i, "Föräldraled.")
    .replace(/^Frivillig skatt$/i, "Friv. skatt");
}

function formatAccount(row) {
  const parts = row.costParts && row.costParts.length ? row.costParts.join(",") : "";
  if (row.account) return `${row.account}${parts ? ` ${parts}` : ""}`;
  return parts || "-";
}
