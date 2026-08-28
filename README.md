# Löneunderlagsgranskare HR+

Ett webbaserat granskningsverktyg för Excel-exporter från Hr+.

Aktuell version: **1.1.0**

Publicerad version: <https://hrlon.lerumsforsamling.se>

## Kort om verktyget

Verktyget gör det enklare att granska löneunderlag per anställd i stället för att arbeta manuellt med filter i Excel.

Det stödjer export från:

- `Ekonomirutin → Bokföringsposter → Mer → Export → Kalkylprogram`
- `Rapporter & Dokument → Transaktionslista → Spara som Excel`
- `Ekonomirutin → Löneunderlagslista → Mer → Export → Kalkylprogram`

## Dataskydd

Importerade Excel-filer behandlas enbart lokalt i din webbläsare. Ingen information från den valda filen skickas vidare till någon server.

Vid besök på sidan hämtas endast själva app-filerna från vår webb (index, css, javascript och bibliotek). Inget filinnehåll från din dator skickas med.

Källkoden är publik så att andra kan granska hur verktyget fungerar.

- [Dataskydd och teknisk säkerhet](docs/security.md)
- [Deployment och cache-beteende](docs/deployment.md)

## Viktigt

Excel-exporter, PDF:er och andra lönefiler ska inte läggas i repot. `.gitignore` blockerar vanliga filtyper som `.xlsx`, `.xls`, `.csv` och `.pdf`.
