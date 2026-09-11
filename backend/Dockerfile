# Node 24 (Active LTS). better-sqlite3 lists 24.x as supported, and no
# dependency in this project has an upper Node-version bound (checked
# 2026-07-21) - @prisma/streams-local only requires >=22, which 24 satisfies.
FROM node:24-alpine

# OS-Pakete auf den aktuellen Alpine-Stand heben — schließt Base-Image-CVEs, die
# unter dem Floating-Tag node:24-alpine noch nicht gepatcht sind (Trivy-Scan auf
# dem Host, 2026-09-11), ergänzt den --pull-Ansatz aus scripts/deploy.sh.
# Zusätzlich das gebündelte npm aktualisieren, das patcht dessen mitgelieferte
# Deps (brace-expansion / ip-address / tar).
RUN apk upgrade --no-cache \
 && apk add --no-cache openssl python3 make g++ tzdata \
 && npm install -g npm@latest

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# Prisma ruft sonst bei jedem CLI-Aufruf (generate, migrate deploy) einen
# synchronen Update-/Telemetrie-Check gegen checkpoint.prisma.io auf - bei
# langsamem/haengendem Netzwerk kann das den Build bzw. den Container-Start
# spuerbar verzoegern, ohne dass eine Fehlermeldung erscheint (beobachtet
# waehrend der E2E-Entwicklung, siehe playwright.config.js).
ENV CHECKPOINT_DISABLE=1
# Nur für lesbare Log-Zeitstempel (siehe ts() in src/index.js, nutzt lokale
# Date-Methoden) - die eigentliche Anwendungslogik rechnet ohnehin überall
# explizit mit Europe/Berlin via Intl (unabhängig von der System-TZ).
ENV TZ=Europe/Berlin

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.js ./
RUN npx prisma generate

COPY src ./src

USER node

EXPOSE 3001

CMD sh -c "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"
