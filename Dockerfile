# Bygger dist/ från källan och serverar den statiskt med nginx.
FROM node:22-alpine AS build
WORKDIR /app
# Bygginfo för version.json (visas i appens hjälp-dialog).
ARG REPO=
ARG BRANCH=
ARG COMMIT=
ARG COMMIT_FULL=
ARG BUILT_AT=
ENV REPO=$REPO BRANCH=$BRANCH COMMIT=$COMMIT COMMIT_FULL=$COMMIT_FULL BUILT_AT=$BUILT_AT
COPY index.html source-notice.html build.mjs ./
COPY vendor ./vendor
COPY src ./src
RUN node build.mjs

FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
