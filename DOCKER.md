# Docker

Appen är helt statisk. Containern bygger `dist/` från källan (`index.html` via
`build.mjs`) och serverar den med nginx. Samma säkerhetsheaders som
`dist/_headers` sätts i `nginx.conf`, plus SPA-fallback.

## Produktion: färdig image från GHCR

GitHub Actions (`.github/workflows/docker.yml`) bygger och pushar
`ghcr.io/armandur/hrplus-lon` vid push till `main` och vid taggar.

```bash
docker compose pull
docker compose up -d
```

Nås på `http://<host>:8848` (t.ex. http://ubuntu-ai:8848). Peka reverse proxy dit.

> Första gången: gör GitHub Packages-paketet **publikt** (Package settings ->
> Change visibility), annars krävs `docker login ghcr.io` för att kunna pulla.

## Lokalt bygge (utan GHCR)

`docker-compose.dev.yml` bygger imagen lokalt. Skicka in git-info så att
versionsrutan i appen stämmer:

```bash
REPO=$(git config --get remote.origin.url) \
BRANCH=$(git rev-parse --abbrev-ref HEAD) \
COMMIT_FULL=$(git rev-parse HEAD) \
BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
docker compose -f docker-compose.dev.yml up -d --build
```

Stoppa: `docker compose -f docker-compose.dev.yml down`.

## Versionsinfo i appen

Vid bygget skapar `build.mjs` `dist/version.json` med repo, branch, commit och
byggtid. Appen hämtar den och visar den under **Hjälp -> Om programmet**, så det
går att se exakt vilken image som körs. Värdena kommer från build-args (Docker/CI)
eller lokal git. Saknas filen visas inget (t.ex. om man öppnar `index.html`
direkt som fil).

## Byt port

Ändra host-porten i `docker-compose.yml` / `docker-compose.dev.yml`:

```yaml
ports:
  - "9000:80"   # <host>:<container>
```

## Filer

- `Dockerfile` - multi-stage: Node bygger `dist/` (med bygginfo), nginx serverar.
- `nginx.conf` - root, säkerhetsheaders, SPA-fallback.
- `.dockerignore` - håller byggkontexten liten.
- `docker-compose.yml` - produktion, image från GHCR.
- `docker-compose.dev.yml` - lokalt bygge.
- `.github/workflows/docker.yml` - bygger/publicerar imagen.
