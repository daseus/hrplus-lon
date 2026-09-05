# Officiell container

Projektets officiellt underhållna container publiceras i GitHub Container
Registry från testad kod på `main` och från versionstaggar.

## Starta

```bash
docker pull ghcr.io/daseus/hrplus-lon:1.2.0
docker run --read-only --tmpfs /tmp --tmpfs /var/cache/nginx \
  -p 8848:8080 ghcr.io/daseus/hrplus-lon:1.2.0
```

Öppna sedan `http://localhost:8848`.

Alternativt:

```bash
docker compose pull
docker compose up -d
```

## Välja version

- `latest` följer senaste godkända versionen på `main`.
- `1.2.0` är en fast utgåva.
- `1.2` följer senaste patchutgåvan inom 1.2.
- `sha-...` låser installationen till en viss commit.

För reproducerbar drift bör en versionstagg eller image-digest användas i stället
för `latest`.

Poster som börjar med `sha256-...` på GitHub Packages är signerade intyg om
byggursprunget, inte körbara container-images. Kopiera därför inte deras
`docker pull`-kommando. En image-digest anges med `@sha256:...`, medan vanliga
versioner anges med exempelvis `:1.2.0`.

## Dataskydd

Containern serverar endast statiska appfiler. Importerade lönefiler behandlas
lokalt i användarens webbläsare och skickas inte till containern.
