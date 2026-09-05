# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY index.html source-notice.html build.mjs ./
COPY src ./src
COPY vendor ./vendor

RUN node build.mjs

FROM nginxinc/nginx-unprivileged:stable-alpine

LABEL org.opencontainers.image.source="https://github.com/daseus/hrplus-lon" \
      org.opencontainers.image.description="Officiell container för Löneunderlagsgranskare HR+"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/version.json || exit 1
