import { runBacktest } from './backtest.js';

export interface Model {
  wSma: number;
  wRsi: number;
  wMacd: number;
  wBoll: number;
  wVol: number;
}

export interface BacktestResult {
  winrate: number;
  avgReturn: number;
  [key: string]: any;
}

export interface TrainResult {
  model: Model;
  score: number;
  result: BacktestResult;
}

export function trainGrid(base: Model, candles: any[]): TrainResult {
  const deltas = [-0.1, -0.05, 0, 0.05, 0.1];

  let best: TrainResult = {
    model: base,
    score: -Infinity,
    result: { winrate: 0, avgReturn: 0 }
  };

  for (const dwSma of deltas) {
    for (const dwRsi of deltas) {
      for (const dwMacd of deltas) {
        for (const dwBoll of deltas) {
          const candidate: Model = {
            wSma: clamp(base.wSma + dwSma, 0, 1),
            wRsi: clamp(base.wRsi + dwRsi, 0, 1),
            wMacd: clamp(base.wMacd + dwMacd, 0, 1),
            wBoll: clamp(base.wBoll + dwBoll, 0, 1),
            wVol: base.wVol
          };

          const res: BacktestResult = runBacktest(candidate, candles);

          // 📌 Puedes personalizar la fórmula de "score"
          const score = res.winrate * 0.7 + res.avgReturn * 0.3;

          if (score > best.score) {
            best = { model: candidate, score, result: res };
          }
        }
      }
    }
  }

  return best;
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
