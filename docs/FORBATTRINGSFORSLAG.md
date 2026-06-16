# Förbättringsförslag: Löneunderlagsgranskare HR+

Hur jag skulle gå tillväga om jag gjorde om/förbättrade projektet, vad jag skulle
ändra och varför. Baserat på den nuvarande koden (en `index.html` på ~2300 rader
med inbäddad CSS/JS, byggd till `dist/` via `build.mjs`).

## Status: genomfört på branchen `forbattringsforslag`

Samtliga etapper nedan är implementerade:

- Etapp 1: ren logik i `src/logic/` + `node:test`-svit (20 tester) + CI.
- Etapp 2: CSS/JS flyttat till `src/`, native ESM, lazy-laddad xlsx, förenklat bygge.
- Etapp 3: locale-robust `parseNumber` (kolumn-alias avvaktar en riktig export).
- Etapp 4: strukturerad import-feedback (typ, antal, överhoppade rader, varning).
- Etapp 5: `tsc --checkJs` på `src/logic` i CI + JSDoc-typer.

Det ursprungliga förslaget följer nedan som referens.

## Filosofi: vad jag behåller

Projektet har en stark grund som jag inte skulle slänga:

- **Allt sker i klienten.** Inga lönefiler lämnar webbläsaren. Det är en
  GDPR-styrka och en bärande designprincip. Behålls.
- **Vanilla JS, ingen bundler, statisk hosting.** Lätt att drifta, inga
  beroenden att hålla aktuella, läsbar källa. Behålls.
- **Strikt CSP och säkerhetsheaders.** Behålls.

Målet är alltså inte ett ramverksbyte, utan att göra samma sak mer
**testbar, navigerbar och robust** utan att lägga på tyngd.

## Det viktigaste först: ordningen spelar roll

Den enskilt viktigaste insikten: **skriv tester runt nuvarande beteende innan
någon omstrukturering.** Logiken (parsning, typdetektering, kategorisering,
tal-/datumformatering) är full av subtila specialfall, och vi har redan hittat
en riktig bugg där (hårdkodat företagsnamn). Ett regressionsnät gör resten av
arbetet säkert. Därför ligger tester som etapp 1, före uppdelningen.

## Prioriterade ändringar

### 1. Testsvit för den rena logiken (högst nytta)

**Nuläge:** Noll tester. Funktioner som `parseTransactionList`, `getSourceType`,
`categorizeRow`, `parseNumber`, `formatDate`, `splitFullName`, `splitPayItem`,
`mergeCostSplitRows` är rena (in -> ut) men oprövade.

**Förslag:** Node:s inbyggda testrunner (`node:test` + `node:assert`), inga
beroenden. Tester för varje parsnings-/detekteringsfunktion med riktiga
edge-case-rader (tomma celler, internationella tal, okänd exporttyp, saknade
kolumner, kostnadsdelade rader som ska slås ihop).

**Varför:** Det är här buggarna bor och det är billigt att täcka. Ger trygghet
att röra resten. Kräver att logiken går att importera fristående -> driver
naturligt fram nästa punkt.

### 2. Dela upp i native ES-moduler (ingen bundler)

**Nuläge:** En fil på ~2300 rader. CSS, markup, parsning, state och rendering
ligger sammanvävt. `build.mjs` plockar ut `<style>`/`<script>` med regex, vilket
är skört.

**Förslag:** Dela källan i `<script type="module">` som webbläsaren laddar direkt:

```
src/
  main.js        # init, event-bindning
  state.js       # state + render-loop
  parse/
    columns.js   # COLUMN_ALIASES, REQUIRED_FIELDS
    detect.js    # getSourceType, transaktionslist-detektering
    rows.js      # normalizeRow, mergeCostSplitRows
    categorize.js
    format.js    # parseNumber, formatDate, formatCurrency, escapeHtml
  ui/
    render.js
    list.js
  styles.css
```

Inga `import`-omskrivningar behövs i drift: native ESM funkar utan bundler.
Bygget blir nästan trivialt (kopiera filer + `version.json`), och regex-pillet i
`build.mjs` försvinner.

**Varför:** Navigerbarhet, och framför allt: modulerna kan importeras direkt i
testerna (punkt 1). Respekterar "ingen bundler".

### 3. Ladda xlsx-biblioteket först vid behov

**Nuläge:** `vendor/xlsx.full.min.js` (~900 kB) laddas synkront i `<head>` på
varje sidladdning, även innan någon valt en fil.

**Förslag:** Lazy-importera biblioteket först när användaren väljer en fil
(dynamisk `import()` eller injicerad `<script>`). Visa en liten "läser in"-status
under tiden.

**Varför:** Initial sidladdning blir dramatiskt lättare. Biblioteket behövs inte
för tomtillståndet.

### 4. Data-driven och robustare parsning

**Nuläge:** Typdetektering är heuristik (`hasBookingDate`/`hasAccount`/`hasScope`),
kolumn-alias är få, och transaktionslistans företagsnamn gissas via regex i
metadata-raderna. `parseNumber` antar svenskt format.

**Förslag:**
- Samla detekteringsreglerna som en deklarativ tabell (typ -> villkor) så att nya
  exportvarianter läggs till på ett ställe.
- Utöka `COLUMN_ALIASES` med fler stavningar/varianter som HR+ exporterar.
- Gör `parseNumber` locale-robust (tolka högraste separatorn som decimaltecken)
  bakom tester, så internationellt formaterade celler inte blir fel.
- Verifiera transaktionslistans företagsnamns-extraktion mot en riktig
  (avidentifierad) export och justera mönstret.

**Varför:** Mindre magi, färre tysta felklassningar, lättare att lägga till stöd
för nya filer. Görs säkert tack vare punkt 1.

### 5. Tydligare import- och felhantering

**Nuläge:** Ett `try/catch` sätter ett statusmeddelande; misslyckas något syns
bara en rad text. Okänd exporttyp och saknade kolumner hanteras knapphändigt.

**Förslag:** Strukturerad import-feedback: vilken typ som identifierades, hur
många rader som lästes/hoppades över och varför, och en tydlig varning vid okänd
exporttyp. Behåll den icke-tekniska tonen.

**Varför:** Användaren granskar löner och måste kunna lita på att inget tappades
tyst. Bättre förtroende och felsökning.

### 6. Lättviktig typsäkerhet utan byggsteg

**Nuläge:** Ren JS, inga typer.

**Förslag:** JSDoc-typer på de centrala datatyperna (rad, anställd, metadata) +
`tsc --checkJs` i CI. Ingen kompilering, ingen bundler, bara felfångst.

**Varför:** Fångar formfel (t.ex. fältnamn som inte stämmer) tidigt, vilket är
precis den klass av bugg projektet är känsligt för. Passar "ingen bundler".

## Vad jag medvetet INTE skulle ändra

- **Inget ramverk** (React/Vue/Svelte). Appen är en vy med en datakälla; ett
  ramverk skulle lägga till beroenden och byggkomplexitet utan verklig vinst.
- **Ingen bundler/transpilering.** Native ESM räcker.
- **Ingen backend/databas.** Klient-bara är poängen.
- **Ingen virtualiseringsmotor från hyllan.** Den enkla IntersectionObserver-
  lösningen räcker för storleksordningen.

## CSS-ramverk (t.ex. Bootstrap) i stället för egen CSS?

Nej, jag skulle inte byta till Bootstrap här. Den handknackade CSS:en är en
tillgång, inte en skuld.

- **Designen finns redan och är sammanhållen** (~947 rader, egen palett, CSS-
  variabler, tydligt utseende). Bootstrap tvingar på "Bootstrap-looken" om man
  inte tungt överskriver den, och då har man både Bootstrap *och* egen CSS att
  underhålla.
- **Det här är ett utskriftsverktyg.** `@media print` är skräddarsydd
  (sidbrytningar, dölj/visa, kolumnlayout per underlagstyp). Bootstraps print-
  stöd är generiskt och skulle göra utskriften svårare, inte enklare.
- **Native `<dialog>` används redan.** Bootstraps interaktiva komponenter kräver
  Bootstraps JS, vilket vore ett steg bakåt mot fler beroenden och sämre CSP.
- **Vikt och stack.** Bootstrap lägger på ~200 kB+ på en medvetet lätt app, och
  ingår inte i den vanliga vanilla-stacken.

**När det vore vettigt:** om man inte vill skriva CSS alls, bygger flera verktyg
som ska se enhetliga ut, eller har ett team som redan kan Bootstrap. Inget av det
stämmer in på en enskilt underhållen intern app med redan polerad design.

**Mellanväg om motivet är struktur, inte utseende:** behåll egen CSS men
formalisera design-tokens (bygg vidare på `--bg`, `--accent` osv.) och lägg ett
tunt utility-lager. Ett klasslöst ramverk (Pico.css, Water.css) krockar med den
befintliga designen och blir i praktiken också en omskrivning. Rekommendationen
är alltså: behåll egen CSS, gör den mer modulär (extern `styles.css` + tokens)
enligt etapp 2.

## Föreslagen etappordning

1. **Regressionsnät:** extrahera ren logik till moduler + `node:test`-svit som
   låser nuvarande beteende. (Låg risk, hög nytta.)
2. **Struktur + bygge:** slutför ESM-uppdelningen, extern CSS, förenkla
   `build.mjs`, lazy-load vendor.
3. **Robusthet:** data-driven detektering, fler kolumn-alias, locale-säker
   `parseNumber`, verifierad företagsnamns-extraktion. Allt bakom testerna.
4. **UX:** strukturerad import-feedback och felhantering.
5. **Typer:** JSDoc + `tsc --checkJs` i CI.

Varje etapp är självständigt mergebar och lämnar appen i ett fungerande skick.
