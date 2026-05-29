FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public
COPY certs ./certs


FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache bash

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/certs ./certs

EXPOSE 3443

CMD ["node", "server.js"]
