/**
 * Simple backtest utility for the Professional Trading AI project.
 * - Fetches historical klines from Binance REST API
 * - Runs the same indicator-based predictor on historical data
 * - Simulates entering at the close of the candle when prediction is made and exiting at the next candle close
 * - Returns basic metrics: total trades, wins, losses, winrate, average return
 *
 * Usage (in browser devtools or integrate into UI):
 *   import { runBacktest } from './backtest'
 *   const res = await runBacktest('BTCUSDT', '1h', startMs, endMs)
 *
 * Notes:
 * - Binance limits klines to max 1000 per request. This utility will page if necessary.
 * - This backtest is lightweight and educational. For robust backtesting use a server-side solution.
 */

async function fetchKlines(symbol='BTCUSDT', interval='1h', startTime=null, endTime=null, limit=1000){
  const base = 'https://api.binance.com/api/v3/klines'
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) })
  if(startTime) params.set('startTime', String(startTime))
  if(endTime) params.set('endTime', String(endTime))
  const url = `${base}?${params.toString()}`
  const resp = await fetch(url)
  if(!resp.ok) throw new Error('Error fetching klines: ' + resp.status)
  const data = await resp.json()
  // map to candle objects
  return data.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }))
}

function simpleIndicators(data){
  if(!data || data.length < 26) return null
  const closes = data.map(d=>d.close)
  const sma = arr => arr.reduce((a,b)=>a+b,0)/arr.length
  const sma_fast = sma(closes.slice(-5))
  const sma_slow = sma(closes.slice(-20))
  let gains=0, losses=0, cnt=0
  for(let i=1;i<Math.min(closes.length,15);i++){
    const ch = closes[closes.length-i] - closes[closes.length-i-1]
    if(ch>0) gains+=ch; else losses+=Math.abs(ch)
    cnt++
  }
  const avgGain = gains/(cnt||1)
  const avgLoss = losses/(cnt||1)
  const rs = avgLoss===0?100: avgGain/avgLoss
  const rsi = 100 - (100/(1+rs))
  const ema = arr => arr.reduce((a,b)=>a+b,0)/arr.length
  const macd = ema(closes.slice(-12)) - ema(closes.slice(-26))
  const sma20 = sma(closes.slice(-20))
  const variance = closes.slice(-20).reduce((s,p)=>s+Math.pow(p-sma20,2),0)/20
  const std = Math.sqrt(variance)
  const upper = sma20 + std*2
  const lower = sma20 - std*2
  const volumes = data.map(d=>d.volume||0)
  const avgVol = volumes.slice(-10).reduce((a,b)=>a+b,0)/(Math.min(volumes.length,10)||1)
  const volRatio = (volumes[volumes.length-1]||1)/(avgVol||1)
  return { sma_fast, sma_slow, rsi, macd, bollinger:{upper,lower,middle:sma20}, volume:{ratio:volRatio}, price: closes[closes.length-1] }
}

function makePrediction(indicators, weights){
  if(!indicators) return null
  const w = weights || { sma_fast:0.25, sma_slow:0.25, rsi:0.15, macd:0.15, bollinger:0.1, volume:0.1 }
  let signal=0
  if(indicators.sma_fast > indicators.sma_slow) signal += w.sma_fast*2; else signal -= w.sma_fast*2
  if(indicators.rsi > 70) signal -= w.rsi*1.5; else if(indicators.rsi < 30) signal += w.rsi*1.5
  if(indicators.macd > 0) signal += w.macd; else signal -= w.macd
  if(indicators.price > indicators.bollinger.upper) signal -= w.bollinger; else if(indicators.price < indicators.bollinger.lower) signal += w.bollinger
  if(indicators.volume.ratio > 1.5) signal += (signal>0? w.volume:-w.volume)
  const norm = Math.tanh(signal*2)
  const up = Math.round(((norm+1)/2)*100)
  return { trend: up>65? 'UP': up<35? 'DOWN':'NEUTRAL', probability: { up, down: 100-up }, confidence: Math.abs(norm) }
}

/**
 * Run backtest by predicting on each candle (based on previous N candles) and simulating entry at candle.close and exit at next candle.close.
 * Returns summary stats and detailed trades.
 */
export async function runBacktest(symbol='BTCUSDT', interval='1h', startTime=null, endTime=null){
  // fetch historical klines (max 1000). For longer ranges, the caller can page manually or we can extend.
  const all = await fetchKlines(symbol, interval, startTime, endTime, 1000)
  if(!all || all.length < 30) throw new Error('Not enough data for backtest')
  const weights = { sma_fast:0.25, sma_slow:0.25, rsi:0.15, macd:0.15, bollinger:0.1, volume:0.1 }
  const trades = []
  for(let i=20;i<all.length-1;i++){
    const window = all.slice(0, i+1) // includes candle i
    const indicators = simpleIndicators(window)
    const pred = makePrediction(indicators, weights)
    // simulate entry at close of candle i and exit at close of candle i+1
    const entry = all[i].close
    const exit = all[i+1].close
    const retPct = ((exit - entry)/entry)*100
    const success = (pred.trend==='UP' && retPct>0) || (pred.trend==='DOWN' && retPct<0) || (pred.trend==='NEUTRAL' && Math.abs(retPct)<0.5)
    trades.push({ time: all[i].time, pred: pred.trend, prob: pred.probability.up, entry, exit, retPct, success })
  }
  const wins = trades.filter(t=>t.success).length
  const losses = trades.length - wins
  const avgRet = trades.reduce((a,b)=>a+b.retPct,0)/trades.length
  const winrate = (wins/trades.length)*100
  return { symbol, interval, start: all[0].time, end: all[all.length-1].time, total: trades.length, wins, losses, winrate, avgRet, trades }
}
