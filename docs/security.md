# Dataskydd och teknisk säkerhet

## Kort svar

Appen behandlar inget löneinnehåll på våra servrar. All laddning, filtrering och summering sker direkt i webbläsaren.

Det betyder att:

- Filen läses lokalt när du väljer den med filväljaren.
- Ingen uppladdning av `xlsx`-filens innehåll sker.
- Inga löneuppgifter skickas vidare när du använder appen.
- När du stänger fliken/rensar data försvinner beräkningarna från webbläsarens minne vid nästa sidladdning.

## Vad som faktiskt skickas

När du besöker appen sker en vanlig läsning av webbplatsfilerna:

- `index.html`
- `assets/app.css`
- `assets/app.js`
- `vendor/xlsx.full.min.js`

Det som du själv väljer från filsystemet (exportfilen) hålls lokalt i webbläsaren.

## Varför detta är säkrare än traditionell export

Syftet med appen är att ersätta manuell kontroll i Excel, inte att flytta data mellan system. Därför hålls datat i samma webbläsarsession.

I praktiken minskar du risken att sprida filer via e-post och mellanlagring.

## Begränsningar du ändå bör känna till

- Lösenordsskydd, skärmlås och giltig inloggning i arbetsmiljön gäller fortfarande.
- Appen kan inte skydda om datorn är infekterad eller en användare lämnar fönstret synligt.
- Delning av sparade utskrifter och utsnitt från skärmen är fortfarande en mänsklig hanteringsrisk.
- Du bör alltid använda officiell länk och aktuellt versionerat innehåll från er egen publiceringsmiljö.

## Länk till källkod

Projektet är öppet för granskning: https://github.com/daseus/hrplus-lon

## Databas och lösen

Det finns ingen databas och inga backend-processer i appen. Den saknar därför ett separat lagringsskikt för löneuppgifter.
