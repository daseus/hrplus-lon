# Deployment och cache

## Publicerad version

Den offentliga sidan ligger i mappen `dist` och publiceras via Cloudflare.

### Snabbt arbetsflöde

När du gör en ändring:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
git add index.html README.md docs source-notice.html build.ps1 dist
git commit -m "Uppdatering"
git push
```

Efter push bygger Cloudflare den publicerade versionen från `dist`.

## Varför hård uppdatering inte ska behövas

`dist/index.html` och `version.json` skickas med `no-store`. HTML-sidan länkar till `app.css`, `app.js` och Excel-biblioteket med versions-parametrar (`?v=...`) som byggaren räknar fram från innehållet. De versionsmärkta resurserna kan därför lagras länge utan att en ny utgåva fastnar på de gamla filerna.

Det gör att webbläsaren får nya resurser när innehållet ändrats, även om statiska filer finns cache:ade.

Appen hämtar dessutom `version.json` utan webbläsarcache när sidan öppnas, återfår fokus eller blir synlig igen. Om en nyare version finns:

- uppdateras sidan automatiskt när ingen lönefil är importerad;
- visas en uppdateringsknapp om en granskning pågår, så att lokalt inlästa uppgifter inte försvinner utan användarens val.

## Rekommenderat beteende för användare

- Öppna sidan normalt från den vanliga länken.
- En redan öppen flik söker efter en ny version när användaren återgår till den.
