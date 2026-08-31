FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/react/package*.json ./
RUN npm ci

COPY frontend/react/ ./

ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=productivity-app
ARG VITE_KEYCLOAK_CLIENT_ID=productivity-app-frontend

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}
ENV VITE_KEYCLOAK_REALM=${VITE_KEYCLOAK_REALM}
ENV VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID}

RUN npm run build -- --mode=production

FROM caddy:2-alpine

COPY --from=build /app/dist /srv
COPY deployment/Caddyfile /etc/caddy/Caddyfile
