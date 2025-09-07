// server/backtest.ts
import { sma, rsi, macd, bollinger, toCloses } from './indicators.js';
import type { Model } from './train.js';
import type { BacktestResult } from './train.js';
import type { Candle } from './types.js';


export function runBacktest(model: Model, candles: Candle[]): BacktestResult {
  const closes = toCloses(candles);
  let wins = 0, losses = 0, totalReturn = 0;
  let trades = 0;

  for (let i = 50; i < closes.length; i++) {
    // === Indicadores ===
    const smaVal = sma(closes.slice(0, i), 20);
    const rsiVal = rsi(closes.slice(0, i), 14);
    const macdVal = macd(closes.slice(0, i));
    const boll = bollinger(closes.slice(0, i));

    // === Señal ponderada ===
    let score = 0;
    if (!isNaN(smaVal)) score += model.wSma * (closes[i] > smaVal ? 1 : -1);
    if (!isNaN(rsiVal)) score += model.wRsi * (rsiVal > 50 ? 1 : -1);
    if (!isNaN(macdVal.macd) && !isNaN(macdVal.signal))
      score += model.wMacd * (macdVal.macd > macdVal.signal ? 1 : -1);
    if (!isNaN(boll.upper) && !isNaN(boll.lower)) {
      if (closes[i] > boll.upper) score -= model.wBoll;
      else if (closes[i] < boll.lower) score += model.wBoll;
    }
    // volumen (placeholder simple)
    score += model.wVol * (candles[i].volume > candles[i - 1].volume ? 1 : -1);

    // === Estrategia básica ===
    const action = score > 0 ? 'BUY' : 'SELL';
    const entry = closes[i];
    const exit = closes[i + 1] ?? entry; // siguiente vela como salida
    const ret = action === 'BUY'
      ? (exit - entry) / entry
      : (entry - exit) / entry;

    trades++;
    totalReturn += ret;
    if (ret > 0) wins++; else losses++;
  }

  const winrate = trades > 0 ? wins / trades : 0;
  const avgReturn = trades > 0 ? totalReturn / trades : 0;

  return {
    winrate,
    avgReturn,
    trades,
    wins,
    losses,
    totalReturn
  };
}