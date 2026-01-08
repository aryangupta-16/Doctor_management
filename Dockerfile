FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate

RUN npx tsc --outDir dist --rootDir src

FROM node:20-slim AS production

ENV NODE_ENV=production
ENV PORT=8000
WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy generated Prisma Client from build stage
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p uploads/profile-pictures && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["node", "dist/server.js"]
