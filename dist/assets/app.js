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
      warningDialog: document.getElementById("warningDialog"),
      warningText: document.getElementById("warningText"),
      warningTitle: document.getElementById("warningTitle"),
      closeWarningButton: document.getElementById("closeWarningButton")
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
    els.closeWarningButton.addEventListener("click", closeWarning);
    els.warningDialog.addEventListener("click", (event) => {
      if (event.target === els.warningDialog) closeWarning();
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
        const parseResult = extractRowsFromSheet(sheet);
        const rawRows = parseResult.rows || [];
        if (!rawRows.length) {
          const reason = parseResult.warnings && parseResult.warnings.length
            ? parseResult.warnings.join("\n")
            : "Kalkylbladet innehåller inga datarader.";
          throw new Error(reason);
        }

        if (parseResult.sourceType === "unknown") {
          throw new Error("Okänt filformat. Denna fil matchar inget av de stödde Hr+-formaten.\n\nSe hjälpavsnittet för filer som stöds (Underlagstyper).");
        }

        validateColumns(rawRows[0], parseResult.sourceType || "auto");
        const importResult = loadRows(rawRows, parseResult.sourceType);
        const warnings = [
          ...(parseResult.warnings || []),
          ...(importResult.warnings || [])
        ];
        if (!state.rows.length) {
          throw new Error("Ingen komplett eller tolkbar post kunde hittas i filen.");
        }
        if (warnings.length) {
          showWarning(`OBS: filformatet kan ha ändrats.\n\n${warnings.join("\n")}\n\nResultatet kan vara ofullständigt.`, "Information");
        }
        setStatus(`Importerade ${formatInteger(state.rows.length)} rader från ${file.name}.`);
      } catch (error) {
        resetData();
        const message = error.message || "Kunde inte läsa filen.";
        setStatus(message, true);
        showWarning(message, "Importfel");
      }
    }

    function extractRowsFromSheet(sheet) {
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
      const transactionRows = parseTransactionList(matrix);
      if (transactionRows.rows.length || transactionRows.sourceType === "transactionList") return transactionRows;
      const payrollDraftRows = parsePayrollDraftRows(matrix);
      if (payrollDraftRows.rows.length || payrollDraftRows.sourceType.includes("payrollDraft")) return payrollDraftRows;

      const fallbackRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
      const inferredSourceType = inferSourceTypeFromRawRows(fallbackRows);
      if (inferredSourceType !== "unknown") {
        fallbackRows.forEach((row) => {
          row.__sourceType = inferredSourceType;
        });
      }
      return {
        sourceType: inferredSourceType,
        rows: fallbackRows,
        warnings: inferredSourceType === "unknown" ? [
          "Kunde inte identifiera filen som ett känt Hr+-exportformat (Bokföringsposter, Transaktionslista eller Löneunderlag från I:)."
        ] : []
      };
    }

    function inferSourceTypeFromRawRows(rows) {
      if (!rows.length) return "unknown";
      const headers = Object.keys(rows[0] || {}).map((value) => cleanText(value).toLowerCase());

      if (headers.includes("bokföringsdatum")) return "accounting";
      if (headers.includes("arbetstagare") && headers.includes("namn") && headers.includes("löneart") && headers.includes("belopp")) {
        return "transactionList";
      }
      return "unknown";
    }

    function parseTransactionList(matrix) {
      const headerIndex = matrix.findIndex((row) => {
        const labels = row.map((cell) => cleanText(cell).toLowerCase());
        return labels.includes("arbetstagare")
          && labels.includes("namn")
          && labels.includes("löneart")
          && labels.includes("belopp");
      });
      if (headerIndex === -1) return { sourceType: "", rows: [], warnings: [] };

      const header = matrix[headerIndex].map(cleanText);
      const employeeIndex = header.findIndex((value) => value === "Arbetstagare");
      const nameIndex = header.findIndex((value) => value === "Namn");
      const typeIndex = header.findIndex((value) => value === "Typ");
      const payItemIndex = header.findIndex((value) => value === "Löneart");
      const accountIndex = header.findIndex((value) => value === "Konto");
      const costCenterIndex = header.findIndex((value) => value === "Avvikande kostnadsställe");
      const amountIndex = header.findIndex((value) => value === "Belopp");
      const paymentDate = findTransactionPaymentDate(matrix);

      const requiredColumns = [
        ["Arbetstagare", employeeIndex],
        ["Namn", nameIndex],
        ["Löneart", payItemIndex],
        ["Belopp", amountIndex]
      ];
      const missingRequired = requiredColumns.filter(([, index]) => index === -1).map(([name]) => name);

      if (missingRequired.length) {
        return {
          sourceType: "transactionList",
          rows: [],
          warnings: [
            `Transaktionslista hittad men saknar obligatoriska kolumner: ${missingRequired.join(", ")}.`
          ]
        };
      }

      const rows = matrix.slice(headerIndex + 1)
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
            Företagsnamn: "Lerums församling",
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

      const warnings = [];
      if (!paymentDate) warnings.push("Transaktionslista: kunde inte läsa utbetalningsdatum från sidhuvudet.");

      return {
        sourceType: "transactionList",
        rows,
        warnings
      };
    }

    function parsePayrollDraftRows(matrix) {
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
        return {
          sourceType: "",
          rows: [],
          warnings: []
        };
      }

      const isIFile = payrollIKeywords.some((keyword) => header.includes(keyword));
      const payrollSourceType = isIFile ? "payrollDraftI" : "payrollDraftHr";
      const sourceTypeLabel = payrollSourceType === "payrollDraftI" ? "Löneunderlag från I:" : "Löneunderlagslista (Hr+)";

      const employeeIdIndex = header.findIndex((value) => value === "anst.id" || value === "anst.nr");
      if (employeeIdIndex === -1) return {
        sourceType: payrollSourceType,
        rows: [],
        warnings: [`${sourceTypeLabel} hittat men saknar kolumn för Anst.id/Anst.nr.`]
      };

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
        return {
          sourceType: payrollSourceType,
          rows: [],
          warnings
        };
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

      return {
        sourceType: payrollSourceType,
        rows,
        warnings
      };
    }

    function findTransactionPaymentDate(matrix) {
      for (const row of matrix.slice(0, 8)) {
        for (const cell of row) {
          const text = cleanText(cell);
          const match = text.match(/Utbetalningsdatum\s+(\d{4}-\d{2}-\d{2}|\d{8})/i);
          if (match) return match[1];
        }
      }
      return "";
    }

    function splitPayItem(value) {
      const text = cleanText(value);
      const match = text.match(/^(.+?)\s+-\s+(.+)$/);
      if (!match) return { code: text, description: text };
      return {
        code: match[1].trim(),
        description: match[2].trim()
      };
    }

    function splitFullName(value) {
      const parts = cleanText(value).split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
      return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1]
      };
    }

    function validateColumns(firstRow, sourceTypeHint = "auto") {
      const missing = REQUIRED_FIELDS
        .filter((field) => !resolveColumn(firstRow, field))
        .map((field) => COLUMN_ALIASES[field][0]);
      if (missing.length) {
        const sourceTypeLabel = {
          payrollDraftHr: "Löneunderlagslista (Hr+)",
          payrollDraftI: "Löneunderlag från I:",
          accounting: "Bokföringsposter",
          transactionList: "Transaktionslista",
          unknown: "ett känt Hr+-format",
          auto: "exportfilen"
        }[sourceTypeHint] || "exportfilen";
        const message = `Saknar förväntade kolumner för ${sourceTypeLabel}: ${missing.join(", ")}.`;
        throw new Error(sourceTypeHint === "unknown" ? `Filen identifierades inte som ett känt format: ${message}` : message);
      }
    }

    function loadRows(rawRows, sourceType = "unknown") {
      const normalizedRows = rawRows.map(normalizeRow);
      const droppedRows = normalizedRows.reduce((count, row) => {
        const hasEmployee = !!(row.employeeName || row.employeeId || row.workerId);
        const hasItem = !!(row.payCode || row.description);
        if (!hasEmployee || !hasItem) {
          return count + 1;
        }
        return count;
      }, 0);

      const rows = normalizedRows.filter((row) => {
        const hasEmployee = !!(row.employeeName || row.employeeId || row.workerId);
        const hasItem = !!(row.payCode || row.description);
        return hasEmployee && hasItem;
      });
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

      const warnings = [];
      if (sourceType !== "payrollDraftHr" && sourceType !== "payrollDraftI") {
        return { rows, droppedRows, warnings: [] };
      }

      const payrollTolerance = Math.max(24, Math.ceil(rawRows.length * 0.15));
      if (droppedRows <= payrollTolerance) {
        return { rows, droppedRows, warnings: [] };
      }
      warnings.push(`${droppedRows} rader saknade nödvändiga uppgifter och tolkades inte.`);
      return { rows, droppedRows, warnings };
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

    function getSourceType(hasBookingDate, hasAccount, hasScope, explicitSourceType = "") {
      if (explicitSourceType === "payrollDraftI") {
        return {
          sourceKey: "payrollDraftI",
          sourceLabel: "Löneunderlag från I:",
          sourceShortLabel: "Löneunderlag",
          sourceTone: "warning",
          dateLabel: "Bokföringsdatum",
          sourceDescription: "Löneunderlaget från löneservice på I:. Visar registrerade lönepåverkande poster och beräkningsunderlag för perioden."
        };
      }

      if (explicitSourceType === "payrollDraftHr") {
        return {
          sourceKey: "payrollDraftHr",
          sourceLabel: "Löneunderlagslista (Hr+)",
          sourceShortLabel: "Löneunderlagslista",
          sourceTone: "warning",
          dateLabel: "Bokföringsdatum",
          sourceDescription: "Löneunderlaget från Ekonomirutin → Löneunderlagslista. Visar registrerade lönepåverkande poster och beräkningsunderlag för vald period."
        };
      }

      if (explicitSourceType === "transactionList") {
        return {
          sourceKey: "transactionList",
          sourceLabel: "Transaktionslista",
          sourceShortLabel: "Trans.lista",
          sourceTone: "normal",
          dateLabel: "Utbetalningsdatum",
          sourceDescription: "Transaktionslista från Rapporter & Dokument. Visar lönearter, skatt och nettolön när löneservice har börjat arbeta med lönerna."
        };
      }

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
          sourceKey: "payrollDraftHr",
          sourceLabel: "Löneunderlagslista (Hr+)",
          sourceShortLabel: "Löneunderlagslista",
          sourceTone: "warning",
          dateLabel: "Period",
          sourceDescription: "Löneunderlagslista från Ekonomirutin. Importen visar registrerade lönepåverkande poster för vald period."
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

    function isPayrollGrossRow(row) {
      const payCode = cleanText(row && row.payCode).toLowerCase();
      const description = cleanText(row && row.description).toLowerCase();
      return /^bru$|^brutto$/.test(payCode) || /bruttolön|brutto/.test(description);
    }

    function isPayrollNetPayRow(row) {
      const payCode = cleanText(row && row.payCode).toLowerCase();
      const description = cleanText(row && row.description).toLowerCase();
      return /^990\b/.test(payCode) || /utbetald\s*nett|nett[oö]lön/.test(description);
    }

    function isPayrollSummaryRow(row) {
      return isPayrollGrossRow(row) || isPayrollNetPayRow(row);
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
          <span>
            <span class="employee-name">${escapeHtml(employee.name)}</span>
            <span class="employee-meta">Anst.nr ${escapeHtml(employee.employeeId || "-")} · ${visibleRows.length}/${employee.rows.length} rader</span>
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
        ${renderPrintHeader(state.metadata ? state.metadata.sourceLabel : "Löneunderlagslista")}
        ${renderSourceNotice()}
        ${renderReportToolbar(
          "Alla anställda",
          `${employees.length} anställda · ${visibleRows.length} synliga rader · ${totalRows} totalrader`
        )}
        ${employees.map((employee) => renderEmployeeReport(employee, true)).join("")}
      `;
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
      if (state.metadata.sourceKey === "payrollDraftI") {
        return `
          <div class="source-notice warning">
            <strong>${escapeHtml(state.metadata.sourceLabel)}:</strong>
            Detta är filen vi får från löneservice på I:.
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
      const sections = groupRowsBySection(getSectionRows(visibleRows));
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
      if (sourceKey === "payrollDraftI") {
        return [
          { label: "Bruttolön", amount: totals.gross },
          { label: "Skatt/avdrag", amount: totals.tax },
          { label: "Nettolön", amount: totals.netPay },
          { label: "Lön/arvoden", amount: totals.pay },
          { label: "Ers./utlägg", amount: totals.reimbursement },
          { label: "Frånvaro/sem.", amount: totals.absence }
        ];
      }

      if (sourceKey === "payrollDraftHr") {
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

    function getSectionRows(rows) {
      const sourceKey = state.metadata ? state.metadata.sourceKey : "";
      if (sourceKey !== "payrollDraftI") return rows;
      return rows.filter((row) => !isPayrollGrossRow(row));
    }

    function getSummaryTotals(employee, visibleRows) {
      const sourceKey = state.metadata ? state.metadata.sourceKey : "";
      const explicitGross = sum(visibleRows.filter((row) => isPayrollGrossRow(row)), "amount");
      const explicitNet = sum(visibleRows.filter((row) => isPayrollNetPayRow(row)), "amount");
      const transactionRows = sourceKey === "payrollDraftI"
        ? visibleRows.filter((row) => !isPayrollSummaryRow(row))
        : visibleRows;
      const pay = sum(transactionRows.filter((row) => row.category === "pay"), "amount");
      const absence = sum(transactionRows.filter((row) => row.category === "absence"), "amount");
      const reimbursement = sum(transactionRows.filter((row) => row.category === "reimbursement"), "amount");
      const other = sum(transactionRows.filter((row) => row.category === "other"), "amount");
      const tax = sum(transactionRows.filter((row) => row.category === "tax"), "amount");
      const netPay = Math.abs(explicitNet || sum(visibleRows.filter((row) => row.category === "net"), "amount"));
      const gross = explicitGross || pay + absence + reimbursement + other;
      return {
        visible: sum(transactionRows, "amount"),
        gross,
        pay,
        absence,
        reimbursement,
        other,
        tax,
        netPay,
        explicitGross,
        explicitNet,
        usesExplicitGross: sourceKey === "payrollDraftI" && Boolean(explicitGross),
        usesExplicitNet: sourceKey === "payrollDraftI" && Boolean(explicitNet)
      };
    }

    function getEmployeeListTotal(visibleRows) {
      const totals = getSummaryTotals(null, visibleRows);
      const sourceKey = state.metadata ? state.metadata.sourceKey : "";
      if ((sourceKey === "transactionList" || sourceKey === "accounting") && totals.netPay) {
        return { label: "Nettolön/utbetalt", amount: totals.netPay };
      }
      if (["payrollDraftHr", "payrollDraftI"].includes(sourceKey)) {
        if (sourceKey === "payrollDraftI" && totals.usesExplicitNet) {
          return { label: "Nettolön", amount: totals.netPay };
        }
        if (sourceKey === "payrollDraftI" && totals.usesExplicitGross) {
          return { label: "Bruttolön", amount: totals.gross };
        }
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
        showWarning(`${APP_INFO.name}\n\nBokförd löneunderlagslista: Ekonomirutin > Bokföringsposter > Mer > Export > Kalkylprogram.\nLöneunderlag från I: (preliminärt löneunderlag): Ekonomirutin > Löneunderlagslista > Mer > Export > Kalkylprogram.\n\nKontakt: ${APP_INFO.contact}`, "Information");
      }
    }

    function closeHelp() {
      if (els.helpDialog.open) els.helpDialog.close();
    }

    function closeWarning() {
      if (els.warningDialog.open) els.warningDialog.close();
    }

    function showWarning(message, title = "Varning") {
      if (typeof els.warningDialog.showModal !== "function") {
        alert(`${title}\n\n${message}`);
        return;
      }
      els.warningTitle.textContent = title;
      els.warningText.textContent = message;
      els.warningDialog.showModal();
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