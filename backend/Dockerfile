FROM node:20-alpine

RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

USER node

EXPOSE 3001

CMD sh -c "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"
