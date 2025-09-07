// server/types.ts

/**
 * Tipos centrales del proyecto
 *
 * Este archivo define tipos estrictos pero flexibles para evitar errores de asignación
 * (p. ej. "Type 'string' is not assignable to type 'Trend'"). Está pensado para ser
 * tolerante a variantes (inglés/español) en algunas señales externas (noticias),
 * y para que el backend y el frontend puedan interoperar sin romperse.
 */

/** Tendencia normalizada que usa el sistema internamente */
export type Trend = 'UP' | 'DOWN' | 'NEUTRAL';

/** Estructura básica de una vela (candle) */
export interface Candle {
  openTime: number;   // ms unix
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;  // ms unix
}

/**
 * Modelo (flexible)
 * - Preferible usar `weights` para contener pesos por indicador.
 * - Se permiten campos legacy (wSma, wRsi, ...) para compatibilidad.
 */
export interface Model {
  weights?: Record<string, number>;
  // legacy optional fields
  wSma?: number;
  wRsi?: number;
  wMacd?: number;
  wBoll?: number;
  wVol?: number;
  // opcional: pesos para noticias
  wNewsShort?: number;
  wNewsLong?: number;
  // campo libre para extender
  [key: string]: any;
}

/** Resultado de una predicción */
export interface Prediction {
  trend: Trend;
  probability: { up: number; down: number }; // valores típicos 0..100 (porcentaje)
  confidence: number; // 0..1
  reasoning: Array<string | Record<string, any>>; // explicaciones textuales o estructuradas
  createdAt?: string; // ISO
  // opcional: los indicadores que generaron la predicción (útil para debugging)
  indicators?: Record<string, any>;
}

/** Entrada para señales de noticias (estructura simple que acepta distintos formatos) */
export interface NewsSignals {
  shortImpact?: number; // -1 .. 1
  longImpact?: number;  // -1 .. 1
  bias?: string;        // 'POSITIVE'|'NEGATIVE'|'NEUTRAL' (o variantes en español)
}

/** Sentimiento de noticia: permitimos variantes en ES/EN para ser tolerantes */
export type Sentiment =
  | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  | 'positivo' | 'negativo' | 'neutral'
  | 'positive' | 'negative' | 'neutral';

/** Impacto temporal de noticia (acepta ES/EN) */
export type Impact = 'short' | 'long' | 'medium' | 'corto' | 'largo' | 'medio';

/** Representación de una noticia analizada */
export interface NewsItem {
  id?: string;
  title: string;
  source?: string;
  url?: string;
  publishedAt: string; // ISO
  summary?: string;
  sentiment?: Sentiment;
  impact?: Impact;
  // scores por si el procesador los calcula
  shortImpact?: number; // -1..1
  longImpact?: number;  // -1..1
  // datos originales sin procesar
  raw?: any;
}

/**
 * Estructura de una simulación guardada en STATE.simulations
 * - probability: porcentaje (ej. probability en el momento de crear la simulación)
 * - reasoning: opcional (recomendado guardar prediction.reasoning)
 */
export interface Simulation {
  id: string;
  entryTime: string;            // ISO string
  exitTime: string | null;
  entryPrice: number;
  exitPrice: number | null;
  trend: Trend;
  probability: number;          // ej. probabilidad de subida al crear (0..100)
  confidence: number;           // 0..1
  entryMethod: string;          // 'analysis-interval' | 'manual' | ...
  closed: boolean;
  success?: boolean;
  profitAmount?: number;
  profitPct?: number;
  reasoning?: Array<string | Record<string, any>>;
  // campos de conveniencia / UI
  openTime?: number;
  timestamp?: string;
  // cualquier otro dato auxiliar
  [key: string]: any;
}

/** Error / registro de aprendizaje para mantener por qué falló una simulación */
export interface LearningError {
  id: string;
  simId?: string;
  predicted?: string;
  actual?: string; // 'WIN' | 'LOSS' | otros
  profitPct?: number;
  createdAt: string; // ISO
  notes?: string;
  meta?: any;
}

/** Estado guardado en disco / memoria del servidor */
export interface ServerState {
  config: {
    simulationIntervalSec: number;
    analysisIntervalSec: number;
    // se pueden añadir más opciones en el futuro
    [key: string]: any;
  };
  model: Model;
  pending: Prediction | null;
  simulations: Simulation[];
  learningErrors: LearningError[];
  news?: NewsItem[]; // cache de noticias procesadas
  // espacio para otros datos persistentes
  [key: string]: any;
}