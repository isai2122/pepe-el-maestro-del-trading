// worker.js
import { ensureTable, saveModelBlob, loadModelBlob, close } from './model-store.js';

const SLEEP_MS = Number(process.env.WORKER_SLEEP_MS || 5000);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Worker arrancando...');
  await ensureTable();

  // Cargar checkpoint si existe
  let modelState;
  try {
    const existing = await loadModelBlob('main-model');
    modelState = existing
      ? JSON.parse(Buffer.from(existing).toString())
      : { epoch: 0, meta: {} };
  } catch (e) {
    console.warn('⚠️ Error parseando modelo guardado, se inicia nuevo', e);
    modelState = { epoch: 0, meta: {} };
  }

  console.log('📦 Estado inicial:', modelState);

  while (true) {
    try {
      // -------------------------
      // Lógica de recolección y entrenamiento
      // -------------------------

      // Ejemplo de trabajo: incrementar epoch y guardar
      modelState.epoch++;
      modelState.meta.lastTick = new Date().toISOString();

      console.log(`[worker] Entrenando epoch ${modelState.epoch} ...`);

      // Guardar checkpoint
      const buf = Buffer.from(JSON.stringify(modelState));
      await saveModelBlob('main-model', buf);
      console.log(`[worker] ✅ Checkpoint guardado epoch=${modelState.epoch}`);

      // Esperar antes del siguiente ciclo
      await sleep(SLEEP_MS);
    } catch (err) {
      console.error('[worker] ❌ Error en loop:', err);
      await sleep(5000);
    }
  }
}

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('🛑 SIGINT recibido, cerrando...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM recibido, cerrando...');
  await close();
  process.exit(0);
});

// Iniciar
main();
