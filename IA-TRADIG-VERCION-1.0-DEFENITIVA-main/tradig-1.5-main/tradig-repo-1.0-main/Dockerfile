# Builder: instala todo y construye (TS + frontend)
FROM node:18-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend/package.json package-lock.json* ./
RUN npm install
COPY . .
# Ejecuta el build: compila server, corrige imports y construye frontend en dist/client
RUN npm run build

# Runtime
FROM node:18-alpine AS runtime
WORKDIR /app
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend/package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD [ "node", "./dist/server/index.js" ]
