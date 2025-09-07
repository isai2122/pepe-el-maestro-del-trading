
# Despliegue en Render (Docker)

- Tipo de servicio: Web Service (Docker)
- Puerto: Render detecta `PORT` automáticamente. El servidor usa `process.env.PORT`.
- Comandos: el Dockerfile se encarga del build y start.

## Variables de entorno
- `PORT` (Render lo define)
- `NODE_ENV=production` (ya seteado en Dockerfile)

## Estructura de build
- Backend: TypeScript -> `dist/server`
- Frontend: Vite -> `dist/client`
- El servidor sirve estáticos desde `dist/client` y hace fallback SPA a `index.html`.
