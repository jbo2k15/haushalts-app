# Node 22 required to satisfy engine requirements of @prisma/streams-local
# (transitive prisma dependency) and avoid npm EBADENGINE warnings.
FROM node:22-alpine

RUN apk add --no-cache openssl python3 make g++ tzdata

WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
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
