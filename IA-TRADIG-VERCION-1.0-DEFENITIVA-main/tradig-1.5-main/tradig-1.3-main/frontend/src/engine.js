// server/engine.js
import fs from "fs";
import { getCandles } from "./binance.js"; 
import { calculateIndicators, makePrediction, analyzeAndAdjust } from "./ai.js";

// Estado inicial del modelo
let state = {
  model: {
    weights: { sma: 1, rsi: 1, macd: 1, bollinger: 1, volume: 1 },
    bias: 0,
    learningRate: 0.1,
  },
  simulations: [],
  errors: [],
};

// Si ya existe un estado previo -> cargarlo
if (fs.existsSync("state.json")) {
  try {
    state = JSON.parse(fs.readFileSync("state.json", "utf8"));
    console.log("📂 Estado cargado desde state.json");
  } catch (e) {
    console.error("⚠️ Error al leer state.json:", e.message);
  }
}

// Lógica principal de simulación
async function tick() {
  try {
    const candles = await getCandles("BTCUSDT", "1m", 200);
    const indicators = calculateIndicators(candles);
    const prediction = makePrediction(state.model, indicators);

    // Abrir nueva simulación si no hay abierta
    if (!state.simulations.some(s => !s.closed)) {
      state.simulations.push({
        id: Date.now(),
        startTime: Date.now(),
        entryPrice: candles[candles.length - 1].close,
        direction: prediction.prediction,
        reasoning: prediction.reasoning,
        closed: false,
      });
      console.log("📈 Nueva simulación abierta:", prediction.prediction);
    }

    // Revisar simulaciones abiertas y cerrarlas después de 1 minuto
    state.simulations.forEach(sim => {
      if (!sim.closed) {
        const lastPrice = candles[candles.length - 1].close;
        const gain = sim.direction === "up"
          ? lastPrice - sim.entryPrice
          : sim.entryPrice - lastPrice;

        if (Date.now() - sim.startTime > 60000) {
          sim.closed = true;
          sim.exitPrice = lastPrice;
          sim.gain = gain;
          state = analyzeAndAdjust(state, sim);
          console.log("✅ Simulación cerrada. Ganancia:", gain.toFixed(2));
        }
      }
    });

    // Guardar estado en disco
    fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("❌ Error en tick:", e.message);
    state.errors.push({ time: Date.now(), error: e.message });
  }
}

// Ejecutar cada 30 segundos
setInterval(tick, 30_000);
tick(); // primera vez inmediata