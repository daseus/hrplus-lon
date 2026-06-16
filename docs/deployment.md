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

## Varför inte behövs hård uppdatering

`dist/index.html` länkar till `app.css` och `app.js` med versions-parametrar (`?v=...`) som byggaren räknar fram från innehållet.

Det gör att webbläsaren får nya resurser när innehållet ändrats, även om statiska filer finns cache:ade.

## Rekommenderat beteende för användare

- Öppna sidan normalt från den vanliga länken.
- Vid ovanliga fall där gamla ändringar syns, gör en hård uppdatering i webbläsaren.
