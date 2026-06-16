# Att göra

## Planerat

- [ ] **Bygg en container för projektet.** Paketera den statiska appen (`dist/`)
  i en enkel container (t.ex. nginx eller en liten statisk server) så att den
  kan köras lokalt/self-hostas utan Cloudflare. Lägg till `Dockerfile` och
  `docker-compose.yml`, och dokumentera i `DOCKER.md`.

- [ ] **Kör igång forken på en vald port på VM:en för demo åt kollega.** Starta
  appen (containern ovan eller en statisk server) på en bevisat ledig port på
  VM:en så att en reverse proxy kan pekas mot den. Notera vald port här när den
  är bestämd.

## Klart

- [x] Virtualisera "Visa alla" (lazy rendering över 40 anställda, print fyller alla).
- [x] Ta bort hårdkodat företagsnamn ("Lerums församling") i transaktionslist-parsningen.
- [x] Plattformsoberoende bygge (`build.mjs` i Node, vid sidan av `build.ps1`).
- [x] `aria-label` på sökfältet.
