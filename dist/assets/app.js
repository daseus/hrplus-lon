const APP_INFO = {
      name: "Löneunderlagsgranskare HR+",
      version: "1.0",
      author: "David Campbell",
      contact: "david.campbell@svenskakyrkan.se"
    };

    const COLUMN_ALIASES = {
      bookingDate: ["Bokföringsdatum"],
      companyCode: ["Företag"],
      company: ["Företagsnamn"],
      unit: ["Enhet"],
      workerId: ["Arbtag.id"],
      employeeId: ["Anst.nr"],
      firstName: ["Förnamn"],
      lastName: ["Efternamn"],
      agreement: ["Avt/kat", "Avtal"],
      payCode: ["Löneart"],
      description: ["Beskrivning", "Benämning"],
      unitPrice: ["Apris"],
      hours: ["Timmar", "Ant/Tim"],
      calendarDays: ["Kal.dgr"],
      workDays: ["Arb.dgr"],
      amount: ["Belopp"],
      fromDate: ["From-datum", "Fr.o.m."],
      toDate: ["Tom-datum", "T.o.m."],
      scope: ["Omfattning %"],
      account: ["Konto"],
      costPart1: ["Kontodel 1"],
      costPart2: ["Kontodel 2"],
      costPart3: ["Kontodel 3"],
      costPart4: ["Kontodel 4"],
      costPart5: ["Kontodel 5"],
      costPart6: ["Kontodel 6"],
      endDate: ["Slutdatum", "Anställd t.o.m."]
    };

    const REQUIRED_FIELDS = [
      "employeeId",
      "firstName",
      "lastName",
      "payCode",
      "description",
      "amount"
    ];

    const SECTION_ORDER = [
      "pay",
      "absence",
      "reimbursement",
      "tax",
      "net",
      "other",
      "technical"
    ];

    const SECTION_LABELS = {
      pay: "Lön/arvoden",
      absence: "Frånvaro/semester",
      reimbursement: "Ers./utlägg",
      tax: "Skatt/avdrag",
      net: "Nettolön",
      other: "Övrigt",
      technical: "Tekn./bokf."
    };

    const TECHNICAL_PATTERNS = [
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

    initializeStaticText();

    async function handleFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        setStatus("Välj en Excel-fil med ändelsen .xlsx eller .xls.", true);
        return;
      }

      setStatus("Läser filen...");

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("Filen innehåller inget kalkylblad.");

        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
        if (!rawRows.length) throw new Error("Kalkylbladet innehåller inga datarader.");

        validateColumns(rawRows[0]);
        loadRows(rawRows);
        setStatus(`Importerade ${formatInteger(state.rows.length)} rader från ${file.name}.`);
      } catch (error) {
        resetData();
        setStatus(error.message || "Kunde inte läsa filen.", true);
      }
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
      const sourceType = getSourceType(hasBookingDate, hasAccount, hasScope);
      return {
        company: first.company || first.companyCode || "-",
        reportDate: reportDate || "-",
        period: period || "-",
        ...sourceType
      };
    }

    function getSourceType(hasBookingDate, hasAccount, hasScope) {
      if (hasBookingDate && hasAccount) {
        return {
          sourceKey: "accounting",
          sourceLabel: "Bokföringsposter",
          sourceShortLabel: "Bokf.poster",
          sourceTone: "normal",
          dateLabel: "Utbetalning/bokföringsdatum",
          sourceDescription: "Komplett löneunderlag när månaden är klar."
        };
      }

      if (!hasBookingDate && hasScope) {
        return {
          sourceKey: "payrollList",
          sourceLabel: "Löneunderlagslista",
          sourceShortLabel: "Löneunderlag",
          sourceTone: "warning",
          dateLabel: "Bokföringsdatum",
          sourceDescription: "Obs! Ej komplett löneunderlag. Visar registrerade lönepåverkande poster och beräkningsunderlag för perioden. Komplett löneunderlagslista hämtas från Ekonomirutin > Bokföringsposter när underlaget är klart för månaden."
        };
      }

      return {
        sourceKey: "unknown",
        sourceLabel: "Okänd exporttyp",
        sourceShortLabel: "Okänd",
        sourceTone: "warning",
        dateLabel: "Bokföringsdatum",
        sourceDescription: "Exporttypen kunde inte identifieras säkert. Kontrollera att filen kommer från Hr+ och är exporterad i formatet Kalkylprogram."
      };
    }

    function summarizeDateSpan(rows) {
      const dates = rows.flatMap((row) => [row.fromDate, row.toDate]).filter(Boolean).sort();
      return summarizeSingleOrSpan(dates);
    }

    function summarizeSingleOrSpan(dates) {
      if (!dates.length) return "";
      return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} - ${dates[dates.length - 1]}`;
    }

    function categorizeRow(payCode, description) {
      const text = `${payCode} ${description}`;
      if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(text))) return "technical";
      if (/nettolön/i.test(text)) return "net";
      if (/skatt|utmätning|avdrag|öresutjämning/i.test(text)) return "tax";
      if (/sjuk|karens|semester|komp|frånvaro|föräldra|vab|ledighet|sparad/i.test(text)) return "absence";
      if (/utlägg|ersättning|bilersättning|km-ers|rese|traktamente|milersättning/i.test(text)) return "reimbursement";
      if (/lön|arvode|ob-|ob |övertid|beredskap|jour|tillägg|timlön|månadslön/i.test(text)) return "pay";
      return "other";
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
          <span>
            <span class="employee-name">${escapeHtml(employee.name)}</span>
            <span class="employee-meta">Anst.nr ${escapeHtml(employee.employeeId || "-")} · ${visibleRows.length}/${employee.rows.length} rader</span>
          </span>
          <span class="employee-total">${formatCurrency(sum(visibleRows, "amount"))}</span>
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
            <p>Välj Excel-exporten från Hr+. All bearbetning sker lokalt i webbläsaren.</p>
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

      els.main.innerHTML = `
        ${renderPrintHeader("Löneunderlagslista")}
        ${renderSourceNotice()}
        ${renderReportToolbar(
          "Alla anställda",
          `${employees.length} anställda · ${visibleRows.length} synliga rader · ${totalRows} totalrader`
        )}
        ${employees.map((employee) => renderEmployeeReport(employee, true)).join("")}
      `;
    }

    function renderPrintHeader(title) {
      const dateMeta = state.metadata && state.metadata.sourceKey === "accounting"
        ? `<div>${escapeHtml(state.metadata.dateLabel)}: ${escapeHtml(state.metadata.reportDate)}</div>`
        : "";
      const periodMeta = !state.metadata || state.metadata.sourceKey !== "accounting"
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
      const dateText = state.metadata.sourceKey === "accounting"
        ? `${state.metadata.dateLabel}: ${state.metadata.reportDate}`
        : "Bokföringsdatum saknas";
      const periodText = state.metadata.sourceKey === "accounting"
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

      return `
        <article class="person-report${isAllReport ? " all-report" : ""}">
          <div class="person-header">
            <div class="person-title">
              <h2>${escapeHtml(employee.name)}</h2>
              <p>Anst.nr ${escapeHtml(employee.employeeId || "-")} · Arbtag.id ${escapeHtml(employee.workerId || "-")} · ${visibleRows.length}/${getVisibleRows(employee).length} rader</p>
            </div>
          </div>

          <div class="summary-grid">
            ${renderSummaryBox("Brutto", totals.pay)}
            ${renderSummaryBox("Ers./utlägg", totals.reimbursement)}
            ${renderSummaryBox("Skatt/avdrag", totals.tax)}
            ${renderSummaryBox("Nettolön", totals.netPay)}
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
      return {
        pay: sum(visibleRows.filter((row) => row.category === "pay"), "amount"),
        reimbursement: sum(visibleRows.filter((row) => row.category === "reimbursement"), "amount"),
        tax: sum(visibleRows.filter((row) => row.category === "tax"), "amount"),
        netPay: Math.abs(sum(visibleRows.filter((row) => row.category === "net"), "amount"))
      };
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
      setTimeout(() => window.print(), 50);
    }

    function initializeStaticText() {
      els.aboutText.textContent = `${APP_INFO.name} version ${APP_INFO.version}. Programmet är framtaget av ${APP_INFO.author}.`;
      els.contactText.textContent = APP_INFO.contact;
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

    function cleanText(value) {
      if (value === null || value === undefined) return "";
      return String(value).trim();
    }

    function resolveColumn(row, field) {
      const aliases = COLUMN_ALIASES[field] || [];
      return aliases.find((name) => Object.prototype.hasOwnProperty.call(row, name)) || "";
    }

    function getValue(row, field) {
      const column = resolveColumn(row, field);
      return column ? row[column] : "";
    }

    function getText(row, field) {
      return cleanText(getValue(row, field));
    }

    function getNumber(row, field) {
      return parseNumber(getValue(row, field));
    }

    function parseNumber(value) {
      if (value === null || value === undefined || value === "") return 0;
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      const normalized = String(value)
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatDate(value) {
      const text = cleanText(value);
      if (!text) return "";
      if (/^\d{8}$/.test(text)) {
        return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        return text.slice(0, 10);
      }
      return text;
    }

    function formatDateRange(fromDate, toDate) {
      if (fromDate && toDate && fromDate !== toDate) return `${fromDate} - ${toDate}`;
      return fromDate || toDate || "-";
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

    function formatCurrency(value) {
      return new Intl.NumberFormat("sv-SE", {
        style: "currency",
        currency: "SEK",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value || 0);
    }

    function formatOptionalCurrency(value) {
      return value ? formatCurrency(value) : "-";
    }

    function formatDecimal(value) {
      return new Intl.NumberFormat("sv-SE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value || 0);
    }

    function formatInteger(value) {
      return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value || 0);
    }

    function sum(rows, field) {
      return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
    }

    function escapeHtml(value) {
      return cleanText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }