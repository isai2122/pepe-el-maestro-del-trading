# Multi-stage build para optimizar el tamaño de la imagen
FROM node:18-alpine AS frontend-build

# Instalar dependencias del frontend
WORKDIR /app/frontend
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend/package.json \
     IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copiar código del frontend y construir
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend ./
RUN yarn build

# Imagen principal con Python
FROM python:3.11-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar Node.js y Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copiar backend
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/backend ./backend/

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copiar frontend build
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Copiar frontend source para desarrollo
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend ./frontend/

# Instalar dependencias del frontend en el contenedor final
WORKDIR /app/frontend
RUN yarn install --frozen-lockfile

# Volver al directorio principal
WORKDIR /app

# Crear directorio de logs
RUN mkdir -p /var/log/supervisor

# Exponer puertos
EXPOSE 8001 3000

# Comando para iniciar supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
