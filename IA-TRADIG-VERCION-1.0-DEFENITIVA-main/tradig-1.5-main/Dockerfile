# Multi-stage build para aplicación React + FastAPI
# Optimizado para Render deployment

# Stage 1: Build React frontend
FROM node:18-alpine as frontend-build

WORKDIR /app/frontend

# Copy package files from root context
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend/package.json frontend/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production

# Copy frontend source
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/frontend ./

# Build frontend for production
RUN yarn build

# Stage 2: Setup Python backend and serve
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install Python dependencies
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY IA-TRADIG-VERCION-1.0-DEFENITIVA-main/backend ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Set environment variables for production
ENV PYTHONPATH=/app
ENV NODE_ENV=production

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Expose port (Render uses PORT environment variable)
EXPOSE ${PORT:-8001}

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8001}/api/health || exit 1

# Start the application
CMD ["python", "backend/server.py"]