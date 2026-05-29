# ---------- Stage 1: Build / dependency stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY server.js ./
COPY public ./public


# ---------- Stage 2: Runtime stage ----------
FROM node:20-alpine AS runtime

RUN apk add --no-cache bash

WORKDIR /app

# Use production mode
ENV NODE_ENV=production

# Copy only the required runtime files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public

# App listens on port 3000
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
