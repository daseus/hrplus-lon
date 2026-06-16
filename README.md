# Löneunderlagsgranskare HR+

En statisk webbapp för att granska Excel-exporter från Hr+ lokalt i webbläsaren.

## Dataskydd

Importerade Excel-filer behandlas lokalt i användarens webbläsare. Appen laddar inte upp lönefiler till någon server.

## Publicering med Cloudflare Workers

Projektet innehåller `wrangler.jsonc`, så Cloudflare kan publicera `dist` som statiska assets via Workers.

Rekommenderad Cloudflare-inställning under Workers & Pages:

- Build command: `exit 0`
- Deploy command: `npx wrangler deploy`
- Path/root directory: lämna tomt eller använd projektroten

`wrangler.jsonc` pekar själv ut `./dist` som publiceringsmapp.

## Uppdatera publiceringsversionen

Kör detta lokalt efter ändringar i `index.html` eller `source-notice.html`.

Plattformsoberoende (kräver Node):

```bash
node build.mjs
```

Windows (PowerShell), motsvarande:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Commita sedan både källfilerna och den uppdaterade `dist`-mappen.

## Filer som inte ska in i Git

Excel-exporter, PDF:er och andra lönefiler ska inte läggas i repot. `.gitignore` blockerar vanliga filtyper som `.xlsx`, `.xls`, `.csv` och `.pdf`.
