FROM node:24-alpine AS builder

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx-unprivileged statt nginx:alpine (Container-Härtung, 2026-09-17):
# läuft standardmäßig als non-root User "nginx" (UID 101) und lauscht auf
# Port 8080 statt 80 (unprivilegierte Prozesse dürfen keine Ports <1024
# binden) - deshalb listen 8080 in nginx.conf + Port-Mapping "80:8080" in
# docker-compose.yml (die Host-Seite bleibt bei 80, extern unveränderlich).
FROM nginxinc/nginx-unprivileged:alpine
# OS-Pakete des Base-Images auf den aktuellen Alpine-Stand heben — nginx:alpine
# wird nicht immer sofort auf gepatchtem Alpine neu gebaut (Trivy 2026-09-11 fand
# util-linux/libuuid-CVEs). Kein npm im finalen Image, daher nur apk upgrade.
# Numerische UID statt Name (hadolint DL3066, analog backend/Dockerfile):
# root=0, "nginx" im nginxinc/nginx-unprivileged-Image stabil UID/GID 101.
USER 0
RUN apk upgrade --no-cache
USER 101
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
