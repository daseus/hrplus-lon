# Att göra

## Planerat

- [ ] **Bygg en container för projektet.** Paketera den statiska appen (`dist/`)
  i en enkel container (t.ex. nginx eller en liten statisk server) så att den
  kan köras lokalt/self-hostas utan Cloudflare. Lägg till `Dockerfile` och
  `docker-compose.yml`, och dokumentera i `DOCKER.md`.

## Klart

- [x] Ta bort hårdkodat företagsnamn ("Lerums församling") i transaktionslist-parsningen.
- [x] Plattformsoberoende bygge (`build.mjs` i Node, vid sidan av `build.ps1`).
- [x] `aria-label` på sökfältet.
