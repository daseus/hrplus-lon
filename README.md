# Löneunderlagsgranskare HR+

Ett webbverktyg för att granska löneunderlag från Hr+. Du öppnar en Excel-export och får underlaget uppdelat per anställd, utan att behöva filtrera manuellt i Excel.

Aktuell version: **1.2.0**

- [Öppna verktyget](https://hrlon.lerumsforsamling.se/)
- [Hämta en version](https://github.com/daseus/hrplus-lon/releases)
- Docker-image: `ghcr.io/daseus/hrplus-lon`

Här finns källkoden som webbversionen och Docker-imagen byggs från.

## Exporter som stöds

Verktyget kan läsa Excel-filer från följande vyer i Hr+:

- `Ekonomirutin → Bokföringsposter → Mer → Export → Kalkylprogram`
- `Rapporter & Dokument → Transaktionslista → Spara som Excel`
- `Ekonomirutin → Löneunderlagslista → Mer → Export → Kalkylprogram`

## Dina filer stannar i webbläsaren

Excel-filerna behandlas lokalt i din webbläsare. Innehållet laddas inte upp till någon server och skickas inte vidare för lagring, analys eller spårning.

När du öppnar sidan hämtar webbläsaren de filer som behövs för att köra verktyget. Innehållet i dina Excel-filer följer inte med i de anropen.

Eftersom löneunderlag innehåller känsliga uppgifter har källkoden granskats särskilt med fokus på dataskydd. Källkoden går också att läsa för den som själv vill granska hur verktyget fungerar.

Det här gäller versionerna som publiceras här och webbversionen som länkas ovan. Om du använder en kopia från någon annan kan koden ha ändrats. Kontrollera därför hur den hanterar filer innan du öppnar känsliga uppgifter.

Läs mer:

- [Dataskydd och teknisk säkerhet](docs/security.md)
- [Publicering och cache](docs/deployment.md)

## Köra med Docker

Docker-imagen byggs från testad kod i det här repot:

```bash
docker pull ghcr.io/daseus/hrplus-lon:1.2.0
docker run --read-only --tmpfs /tmp --tmpfs /var/cache/nginx \
  -p 8848:8080 ghcr.io/daseus/hrplus-lon:1.2.0
```

Se [containerdokumentationen](DOCKER.md) för fasta versioner och Docker Compose.

## Bygga

Efter ändringar i `index.html`, `src/` eller `source-notice.html` behöver du uppdatera `dist/`. Bygget kräver Node:

```bash
node build.mjs
```

På Windows kan du också använda PowerShell:

```powershell
.\build.ps1
```

Commita både källfilerna och den uppdaterade `dist/`-mappen.

Bygget ger JavaScript, CSS, logikmoduler och Excel-biblioteket filnamn med innehållshashar. Det hjälper webbläsaren att hämta rätt filer när en ny version publiceras. Läs mer om hur uppdateringar hanteras i [dokumentationen om publicering och cache](docs/deployment.md).

## Utveckling

Källkoden ligger i `src/`. Beräknings- och bearbetningslogiken finns i `src/logic/`, och kopplingarna till gränssnittet finns i `src/app.js`.

Kör testerna med:

```bash
node --test
```

Typkontrollera logiken med:

```bash
npx -y -p typescript@5.9.2 tsc --noEmit -p tsconfig.json
```

För att rapportera fel eller bidra med ändringar, se [CONTRIBUTING.md](CONTRIBUTING.md). Hur projektet underhålls och nya versioner publiceras beskrivs i [maintenance.md](docs/maintenance.md).

## Håll lönefiler utanför repot

Lägg inte Excel-exporter, PDF:er eller andra lönefiler i repot. `.gitignore` är inställd på att ignorera vanliga filtyper som `.xlsx`, `.xls`, `.csv` och `.pdf`.
