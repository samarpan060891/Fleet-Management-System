# Single-service image: builds the frontend + backend and serves both from the
# Express process. Intended for Railway (or any single-container host).
# The backend serves the built SPA from STATIC_DIR and runs migrations + an
# idempotent seed on boot.

# --- Frontend build ---
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build            # -> /fe/dist

# --- Backend build ---
FROM node:22-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build            # -> /app/dist

# --- Runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# node_modules from the backend build stage keep Prisma client + ts-node (seed).
COPY backend/package*.json ./
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/dist ./dist
COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/docker-entrypoint.sh ./
# Built SPA served by the API.
COPY --from=frontend /fe/dist ./public
ENV STATIC_DIR=/app/public
RUN chmod +x docker-entrypoint.sh
# Railway injects PORT; the app reads it. Expose the default for local runs.
EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
