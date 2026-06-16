// Identifiering av exporttyp utifrån vilka fält som finns.

export function getSourceType(hasBookingDate, hasAccount, hasScope, explicitSourceType = "") {
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
