# Löneunderlagsgranskare HR+

Ett webbaserat granskningsverktyg för Excel-exporter från Hr+.

Aktuell version: **1.2.0**

> Detta är projektets officiellt underhållna repository. Godkända releaser,
> webbversionen och container-images publiceras härifrån.

- Officiell webbversion: <https://hrlon.lerumsforsamling.se>
- Officiell container: `ghcr.io/daseus/hrplus-lon`
- Releaser: <https://github.com/daseus/hrplus-lon/releases>

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

Eftersom verktyget används för löneunderlag har källkoden granskats särskilt
med fokus på dataskydd. Importerade filer behandlas lokalt i webbläsaren och
innehållet skickas inte vidare genom nätverksanrop för lagring, analys eller
spårning.

Jag kan bara säkerställa detta för koden och de versioner som publiceras från
detta repository. Forks och andra distributioner kan innehålla egna ändringar
och behöver därför granskas separat innan de används med känsliga uppgifter.

## Köra med Docker

Den officiella imagen byggs från testad kod i detta repository:

```bash
docker pull ghcr.io/daseus/hrplus-lon:1.2.0
docker run --read-only --tmpfs /tmp --tmpfs /var/cache/nginx \
  -p 8848:8080 ghcr.io/daseus/hrplus-lon:1.2.0
```

Se [containerdokumentationen](DOCKER.md) för fasta versioner och Docker Compose.

## Bygga

Bygg `dist/` efter ändringar i `index.html`, `src/` eller `source-notice.html`. Bygget kräver Node och fungerar på alla plattformar:

```bash
node build.mjs
```

På Windows fungerar även den befintliga PowerShell-kommandoraden:

```powershell
.\build.ps1
```

Commita sedan både källfilerna och den uppdaterade `dist`-mappen. Bygget lägger innehållshashar på JavaScript, CSS, logikmoduler och Excel-biblioteket så att publicerade uppdateringar når redan öppna webbläsare utan att en pågående granskning försvinner.

## Utveckling

Källkoden ligger i `src/`, med ren logik i `src/logic/` och UI-kopplingar i `src/app.js`. Tester körs med `node --test`. Den rena logiken typkontrolleras med `npx -y -p typescript@5.9.2 tsc --noEmit -p tsconfig.json`.

Bidrag hanteras genom issues och pull requests enligt [CONTRIBUTING.md](CONTRIBUTING.md). Förvaltnings- och releaseflödet finns beskrivet i [docs/maintenance.md](docs/maintenance.md).

## Viktigt

Excel-exporter, PDF:er och andra lönefiler ska inte läggas i repot. `.gitignore` blockerar vanliga filtyper som `.xlsx`, `.xls`, `.csv` och `.pdf`.
