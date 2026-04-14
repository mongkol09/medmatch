# ==========================================
# MedMatch API — Railway Monorepo Dockerfile
# Build context: monorepo root (medmatch-api/ subdir)
# ==========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY medmatch-api/package*.json ./
COPY medmatch-api/prisma ./prisma/

RUN npm ci

COPY medmatch-api/ .

RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
