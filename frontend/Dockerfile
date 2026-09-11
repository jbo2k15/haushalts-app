FROM node:24-alpine AS builder

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# OS-Pakete des Base-Images auf den aktuellen Alpine-Stand heben — nginx:alpine
# wird nicht immer sofort auf gepatchtem Alpine neu gebaut (Trivy 2026-09-11 fand
# util-linux/libuuid-CVEs). Kein npm im finalen Image, daher nur apk upgrade.
RUN apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
