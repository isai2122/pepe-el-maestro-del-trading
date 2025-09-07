// server/model.ts
import type { ServerState, NewsItem as NewsItemType } from './types.js';
import { loadState, saveState } from './state.js';


export interface Signal {
  decision: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string[];
}

/**
 * impactFromNews
 * - Procesa las noticias guardadas en state.news
 * - Calcula un índice de sentimiento agregado a corto y largo plazo
 */
function impactFromNews(state: ServerState) {
  if (!state.news || state.news.length === 0) {
    return { shortTerm: 0, longTerm: 0, reasoning: ["No recent news"] };
  }

  const now = Date.now();

  let shortScore = 0;
  let longScore = 0;
  let countShort = 0;
  let countLong = 0;

  state.news.forEach((n: NewsItemType) => {
    if (!n.sentiment) return; // Evitar undefined

    const ageHours = (now - new Date(n.publishedAt).getTime()) / (1000 * 60 * 60);

    let val = 0;
    if (n.sentiment === "positive") val = 1;
    if (n.sentiment === "negative") val = -1;

    // Corto plazo: últimas 24 horas
    if (ageHours <= 24) {
      shortScore += val;
      countShort++;
    }

    // Largo plazo: últimas 2 semanas
    if (ageHours <= 24 * 14) {
      longScore += val;
      countLong++;
    }
  });

  const shortAvg = countShort > 0 ? shortScore / countShort : 0;
  const longAvg = countLong > 0 ? longScore / countLong : 0;

  const reasoning: string[] = [];
  reasoning.push(`Short-term sentiment: ${shortAvg.toFixed(2)}`);
  reasoning.push(`Long-term sentiment: ${longAvg.toFixed(2)}`);

  return { shortTerm: shortAvg, longTerm: longAvg, reasoning };
}

/**
 * decide
 * - Genera una señal de trading combinando modelo técnico + impacto de noticias
 */
export function decide(state: ServerState): Signal {
  const reasons: string[] = [];

  let technicalSignal: "buy" | "sell" | "hold" = "hold";
  let confidence = 0.5;

  reasons.push("Technical model baseline: neutral hold");

  const newsImpact = impactFromNews(state);
  reasons.push(...newsImpact.reasoning);

  if (newsImpact.shortTerm > 0.3) {
    technicalSignal = "buy";
    confidence += 0.2;
    reasons.push("Positive short-term news → strengthen BUY");
  } else if (newsImpact.shortTerm < -0.3) {
    technicalSignal = "sell";
    confidence += 0.2;
    reasons.push("Negative short-term news → strengthen SELL");
  }

  if (newsImpact.longTerm > 0.3) {
    if (technicalSignal === "buy") confidence += 0.1;
    reasons.push("Positive long-term news → reinforce long exposure");
  } else if (newsImpact.longTerm < -0.3) {
    if (technicalSignal === "sell") confidence += 0.1;
    reasons.push("Negative long-term news → reinforce short exposure");
  }

  confidence = Math.min(1, Math.max(0, confidence));

  return {
    decision: technicalSignal,
    confidence,
    reasoning: reasons
  };
}

/**
 * predict
 * - Función exportada para index.ts
 * - Recibe cualquier input (por ejemplo estado actual) y devuelve la señal
 */
export function predict(inputState: ServerState): Signal {
  return decide(inputState);
}
