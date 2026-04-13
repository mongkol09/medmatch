# ==========================================
# MedMatch API — Multi-stage Dockerfile
# ==========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Create uploads directory for local storage fallback
RUN mkdir -p /app/uploads

ENV NODE_ENV=production

EXPOSE 3000

# Use local prisma binary (faster than npx, no network download)
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
