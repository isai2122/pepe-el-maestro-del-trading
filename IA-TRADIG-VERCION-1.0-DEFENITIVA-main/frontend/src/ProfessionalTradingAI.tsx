import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createChart } from 'lightweight-charts'

type Trend = 'UP' | 'DOWN' | 'NEUTRAL'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  isFinal?: boolean
  timestamp?: string
}

interface Simulation {
  id: string
  timestamp: string
  entryPrice: number
  entryTime: number
  trend: Trend
  probability?: { up: number; down: number } | null
  confidence?: number
  openTime?: number
  entryMethod?: string
  closed?: boolean
  exitPrice?: number | null
  exitTime?: string | null
  /** SIEMPRE firmado según la dirección (UP: +sube, DOWN: +baja) */
  resultPct?: number | null
  success?: boolean
  entrySide?: string
}

const PENDING_KEY = 'ptai_pending_v1'
const SIMS_KEY = 'ptai_sims_v1'

function loadSims(): Simulation[] {
  try {
    const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(SIMS_KEY)) || '[]'
    return JSON.parse(raw)
  } catch {
    return []
  }
}
function saveSims(arr: Simulation[]) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SIMS_KEY, JSON.stringify(arr))
  } catch {}
}

export default function ProfessionalTradingAI(): JSX.Element {
  const pair = 'BTCUSDT'
  const timeframe = '5m'

  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [marketData, setMarketData] = useState<Candle[]>([])
  const marketRef = useRef<Candle[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [simulations, setSimulations] = useState<Simulation[]>(() => loadSims())
  const [currentPrediction, setCurrentPrediction] = useState<any | null>(null)
  const [analysis, setAnalysis] = useState<any | null>(null)

  // tabs
  const [view, setView] = useState<'sim' | 'hist' | 'cuentas' | 'errores'>('sim')

  // news
  const [news, setNews] = useState<any[] | null>(null)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsLoading, setNewsLoading] = useState(false)

  useEffect(() => { saveSims(simulations) }, [simulations])

  /* ------------- helpers ------------- */
  const calculateIndicators = useCallback((data?: Candle[]) => {
    if (!data || data.length < 26) return null
    const closes = data.map(d => d.close)
    const sma = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
    const sma_fast = sma(closes.slice(-5))
    const sma_slow = sma(closes.slice(-20))

    let gains = 0, losses = 0, count = 0
    for (let i = 1; i < Math.min(closes.length, 15); i++) {
      const ch = closes[closes.length - i] - closes[closes.length - i - 1]
      if (ch > 0) gains += ch; else losses += Math.abs(ch)
      count++
    }
    const avgGain = gains / (count || 1)
    const avgLoss = losses / (count || 1)
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))
    const ema = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
    const macd = ema(closes.slice(-12)) - ema(closes.slice(-26))

    const sma20 = sma(closes.slice(-20))
    const variance = closes.slice(-20).reduce((s, p) => s + Math.pow(p - sma20, 2), 0) / 20
    const std = Math.sqrt(variance || 0)
    const upper = sma20 + std * 2
    const lower = sma20 - std * 2

    const volumes = data.map(d => d.volume || 0)
    const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / (Math.min(volumes.length, 10) || 1)
    const volRatio = (volumes[volumes.length - 1] || 1) / (avgVol || 1)

    return { sma_fast, sma_slow, rsi, macd, bollinger: { upper, lower, middle: sma20 }, volume: { ratio: volRatio }, price: closes[closes.length - 1] }
  }, [])

  const makePrediction = useCallback((indicators: any) => {
    if (!indicators) return null
    const w = { sma_fast: 0.25, rsi: 0.15, macd: 0.15, bollinger: 0.10, volume: 0.10 }
    let signal = 0
    const reasoning: string[] = []
    if (indicators.sma_fast > indicators.sma_slow) { signal += (w.sma_fast || 0) * 2; reasoning.push('SMA rápida > lenta') }
    else { signal -= (w.sma_fast || 0) * 2; reasoning.push('SMA rápida < lenta') }
    if (indicators.rsi > 70) { signal -= (w.rsi || 0) * 1.5; reasoning.push('RSI alto') }
    else if (indicators.rsi < 30) { signal += (w.rsi || 0) * 1.5; reasoning.push('RSI bajo') }
    if (indicators.macd > 0) { signal += (w.macd || 0); reasoning.push('MACD positivo') } else { signal -= (w.macd || 0); reasoning.push('MACD negativo') }
    if (indicators.price > indicators.bollinger.upper) { signal -= (w.bollinger || 0); reasoning.push('Precio>Upper Bollinger') }
    else if (indicators.price < indicators.bollinger.lower) { signal += (w.bollinger || 0); reasoning.push('Precio<Lower Bollinger') }
    if (indicators.volume?.ratio > 1.5) { const vs = signal > 0 ? (w.volume || 0) : -(w.volume || 0); signal += vs; reasoning.push('Volumen alto') }
    const norm = Math.tanh(signal * 2)
    const up = Math.round(((norm + 1) / 2) * 100)
    const down = 100 - up
    const trend: Trend = up > 65 ? 'UP' : down > 65 ? 'DOWN' : 'NEUTRAL'
    const confidence = Math.abs(norm)
    return { trend, probability: { up, down }, confidence, reasoning, indicators }
  }, [])

  /* ------------- chart ------------- */
  useEffect(() => {
    if (!containerRef.current) return
    try { containerRef.current.innerHTML = '' } catch {}
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 520,
      layout: { background: '#071230', textColor: '#dbeafe' },
      grid: { vertLines: { color: '#0b1220' }, horzLines: { color: '#0b1220' } }
    } as any)
    const series = chart.addCandlestickSeries({ upColor: '#10b981', downColor: '#fb7185', borderVisible: false } as any)
    chartRef.current = chart; seriesRef.current = series
    const resize = () => chart.applyOptions({ width: containerRef.current ? containerRef.current.clientWidth : 800 })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    const data = marketData.map(d => ({ time: Math.floor(d.time / 1000), open: d.open, high: d.high, low: d.low, close: d.close }))
    try { (seriesRef.current as any).setData(data) } catch {}
  }, [marketData])

  /* ------------- data & ws ------------- */
  const fetchHistorical = useCallback(async (limit = 500) => {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${timeframe}&limit=${limit}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Error fetching historical klines')
      const data = await resp.json()
      const mapped: Candle[] = data.map((k: any) => ({
        time: Number(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        timestamp: new Date(Number(k[0])).toLocaleString()
      }))
      setMarketData(mapped); marketRef.current = mapped
      if (seriesRef.current) {
        try {
          seriesRef.current.setData(mapped.map(d => ({ time: Math.floor(d.time / 1000), open: d.open, high: d.high, low: d.low, close: d.close })))
        } catch {}
      }
    } catch (e) {
      console.error('fetchHistorical error', e)
    }
  }, [pair, timeframe])

  // utilidad coherente para % firmado según dirección
  const computeProfitPct = (s: Simulation) => {
    if (typeof s.exitPrice !== 'number' || typeof s.entryPrice !== 'number') return 0
    const raw = ((s.exitPrice - s.entryPrice) / s.entryPrice) * 100
    return s.trend === 'UP' ? raw : -raw
  }

  useEffect(() => {
    let ws: WebSocket | null = null
    const connect = async () => {
      try {
        if ((marketRef.current?.length || 0) < 30) await fetchHistorical(500)
        const symbol = pair.toLowerCase()
        const stream = `${symbol}@kline_${timeframe}`
        const url = `wss://stream.binance.com:9443/ws/${stream}`
        ws = new WebSocket(url)
        wsRef.current = ws
        ws.onopen = () => setConnected(true)
        ws.onclose = () => setConnected(false)
        ws.onerror = () => setConnected(false)
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse((ev as MessageEvent).data)
            if (!msg.k) return
            const k = msg.k
            const candle: Candle & { isFinal?: boolean } = {
              time: Number(k.t), open: parseFloat(k.o), high: parseFloat(k.h),
              low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v), isFinal: !!k.x
            }
            setMarketData(prev => {
              const copy = [...prev]
              if (copy.length && copy[copy.length - 1].time === candle.time) copy[copy.length - 1] = candle
              else { copy.push(candle); if (copy.length > 2000) copy.shift() }
              marketRef.current = copy
              return copy
            })
            setLastUpdate(new Date())

            if (candle.isFinal) {
              // cerrar simulación pendiente con % firmado por dirección
              const pendingRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(PENDING_KEY) : null
              if (pendingRaw) {
                try {
                  const p = JSON.parse(pendingRaw)
                  setSimulations(prev => prev.map(s => {
                    if (s.id !== p.simId) return s
                    const rawPct = ((candle.close - p.price) / (p.price || candle.close)) * 100
                    const adjPct = s.trend === 'UP' ? rawPct : -rawPct
                    return {
                      ...s,
                      closed: true,
                      exitPrice: candle.close,
                      exitTime: new Date().toLocaleString(),
                      resultPct: adjPct,
                      success: adjPct > 0
                    }
                  }))
                  localStorage.removeItem(PENDING_KEY)
                } catch {}
              }
              const all = marketRef.current
              const indicators = calculateIndicators(all)
              if (indicators) {
                const pred = makePrediction(indicators)
                if (pred) { setCurrentPrediction(pred); setAnalysis(pred) }
              }
            }
          } catch (e) { console.error('ws msg parse', e) }
        }
      } catch (e) {
        console.error('WS connect error', e); setConnected(false)
      }
    }
    connect()
    return () => { try { ws && ws.close() } catch {} }
  }, [fetchHistorical, calculateIndicators, makePrediction])

  /* ------------- rolling prediction ------------- */
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        const all = marketRef.current || []
        const indicators = calculateIndicators(all)
        if (!indicators) return
        const prediction = makePrediction(indicators)
        if (!prediction) return
        setCurrentPrediction(prediction); setAnalysis(prediction)

        if (!(typeof localStorage !== 'undefined' && localStorage.getItem(PENDING_KEY)) && all.length) {
          const last = all[all.length - 1]
          const simId = 'sim_' + Date.now()
          const entrySide = prediction.trend === 'UP' ? 'Arriba' : prediction.trend === 'DOWN' ? 'Abajo' : 'Neutral'
          const sim: Simulation = {
            id: simId,
            timestamp: new Date().toLocaleString(),
            entryPrice: last.close,
            entryTime: last.time,
            trend: prediction.trend,
            entrySide,
            probability: prediction.probability,
            confidence: prediction.confidence,
            openTime: last.time,
            entryMethod: 'AUTO_30S',
            closed: false
          }
          setSimulations(prev => [...prev, sim])
          if (typeof localStorage !== 'undefined') localStorage.setItem(PENDING_KEY, JSON.stringify({ prediction, price: last.close, time: last.time, simId }))
        }
      } catch (e) { console.error('rolling pred error', e) }
    }, 30000)
    return () => clearInterval(iv)
  }, [calculateIndicators, makePrediction])

  /* ------------- news ------------- */
  async function loadNews() {
    setNewsLoading(true); setNewsError(null)
    try {
      const r = await fetch('/news')
      if (!r.ok) throw new Error(`news fetch failed (${r.status})`)
      try {
        const j = await r.json()
        if (Array.isArray(j)) { setNews(j); return }
        if (j && Array.isArray((j as any).articles)) { setNews((j as any).articles); return }
      } catch (jsonErr) {
        const txt = await r.text()
        const cdataMatches = Array.from(txt.matchAll(/<!\[CDATA\[(.*?)\]\]>/gs)).map(m => m[1].trim()).filter(Boolean)
        if (cdataMatches.length) { setNews(cdataMatches.map(t => ({ title: t }))); return }
        const titleMatches = Array.from(txt.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)).map(m => m[1].trim()).filter(Boolean)
        if (titleMatches.length) {
          const items = titleMatches.slice(titleMatches.length > 10 ? 1 : 0).slice(0, 10).map(t => ({ title: t }))
          setNews(items); return
        }
        setNews([{ title: txt.slice(0, 2000) }])
        return
      }
    } catch (e: any) {
      setNews(null); setNewsError(String(e.message || e))
    } finally {
      setNewsLoading(false)
    }
  }
  useEffect(() => { loadNews() }, [])

  /* ------------- stats ------------- */
  const closedSims = simulations.filter(s => s.closed && typeof s.exitPrice === 'number' && typeof s.entryPrice === 'number')
  const wins = closedSims.filter(s => computeProfitPct(s) > 0).length
  const losses = closedSims.filter(s => computeProfitPct(s) <= 0).length
  const total = simulations.length
  const winRate = closedSims.length ? (wins / closedSims.length) * 100 : 0
  const avgProfit = closedSims.length ? closedSims.reduce((a, b) => a + computeProfitPct(b), 0) / closedSims.length : 0
  const best = closedSims.length ? Math.max(...closedSims.map(s => computeProfitPct(s))) : 0
  const worst = closedSims.length ? Math.min(...closedSims.map(s => computeProfitPct(s))) : 0

  /* ------------- UI ------------- */
  return (
    <div className="container">
      <div className="card header">
        <div>
          <h1>Professional Trading AI — BTC/USDT ({timeframe})</h1>
          <div className="small">Conexión: {connected ? <span className="green">Real-time</span> : <span className="small">Desconectado</span>}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="small">Última actualización: {lastUpdate ? lastUpdate.toLocaleString() : '—'}</div>
        </div>
      </div>

      <div className="layout">
        <div className="card">
          <div className="section-title">Gráfico de velas (en tiempo real)</div>
          <div className="chart-wrap" ref={containerRef}></div>
        </div>

        <div className="card">
          <div className="section-title">Predicción actual</div>
          <div className="pred-box">
            {currentPrediction ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {currentPrediction.trend === 'UP' ? 'Predicción: SUBIR' :
                       currentPrediction.trend === 'DOWN' ? 'Predicción: BAJAR' : 'Predicción: NEUTRAL'}
                    </div>
                    <div className="small">
                      Prob. ↑: <span className="green">{currentPrediction.probability.up}%</span> • ↓: <span className="red">{currentPrediction.probability.down}%</span>
                    </div>
                    <div className="small">Confianza: {(currentPrediction.confidence * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="small">Razonamiento:</div>
                  <div style={{ marginTop: 6 }}>
                    {currentPrediction.reasoning?.map((r: string, i: number) => (
                      <div key={i} className="small" style={{ marginBottom: 4 }}>• {r}</div>
                    ))}
                  </div>
                </div>
              </>
            ) : <div className="small">Esperando primera predicción...</div>}
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button className={`controls ${view === 'sim' ? 'active' : ''}`} onClick={() => setView('sim')}>Simulaciones</button>
            <button className={`controls ${view === 'hist' ? 'active' : ''}`} onClick={() => setView('hist')}>Historial</button>
            <button className={`controls ${view === 'cuentas' ? 'active' : ''}`} onClick={() => setView('cuentas')}>Cuentas</button>
            <button className={`controls ${view === 'errores' ? 'active' : ''}`} onClick={() => setView('errores')}>Errores</button>
          </div>

          {/* CÁPSULA con scroll interno y todas las simulaciones */}
          <div
            className="sims-capsule"
            style={{
              borderRadius: 12,
              marginBottom: 12,
              border: '1px solid #1f2a44',
              background: 'rgba(7, 18, 48, 0.6)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset'
            }}
          >
            <div
              className="sims-scroll"
              style={{
                padding: 12,
                maxHeight: 460,            // altura fija para que no estire la página
                overflowY: 'auto'          // scroll interno visible
              }}
            >
              {view === 'sim' && (
                <>
                  {simulations.slice().reverse().map(s => {
                    const profit = s.closed ? (typeof s.resultPct === 'number' ? s.resultPct : computeProfitPct(s)) : null
                    const profitPos = profit != null && profit > 0
                    return (
                      <div key={s.id} className="row">
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            <span style={{ color: s.trend === 'UP' ? '#10b981' : s.trend === 'DOWN' ? '#fb7185' : 'var(--muted)' }}>
                              {s.trend} {s.entrySide ? `• ${s.entrySide}` : ''} • {s.timestamp}
                            </span>
                          </div>
                          <div className="small">
                            Entrada: {typeof s.entryPrice === 'number' ? s.entryPrice.toFixed(2) : '-'}
                            {' '}• Prob ↑:{s.probability?.up ?? '-'}% • Prob ↓:{s.probability?.down ?? '-'}%
                          </div>
                          {s.closed && (
                            <div className="small">
                              Salida: {s.exitPrice?.toFixed?.(2)} • {s.exitTime} • Resultado:{' '}
                              <span className={profitPos ? 'green' : 'red'}>
                                {profit != null ? profit.toFixed(2) + '%' : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {simulations.length === 0 && <div className="small">Aún no hay simulaciones.</div>}
                </>
              )}

              {view === 'hist' && (
                <div>
                  {simulations.slice().reverse().map(s => (
                    <div key={s.id} className="row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.timestamp} • {s.trend} ({s.entrySide})</div>
                        <div className="small">Entrada: {s.entryPrice?.toFixed(2)} • Prob↑:{s.probability?.up ?? '-'}% • Prob↓:{s.probability?.down ?? '-'}%</div>
                        {s.closed ? (
                          <div className="small">
                            Cierre: {s.exitPrice?.toFixed(2)} • {s.exitTime} • Resultado:{' '}
                            <span className={(s.resultPct ?? computeProfitPct(s)) > 0 ? 'green' : 'red'}>
                              {(s.resultPct ?? computeProfitPct(s)).toFixed(2)}%
                            </span>
                          </div>
                        ) : <div className="small">En curso…</div>}
                      </div>
                    </div>
                  ))}
                  {simulations.length === 0 && <div className="small">Sin registros todavía.</div>}
                </div>
              )}

              {view === 'cuentas' && (
                <div style={{ padding: 8 }}>
                  <div className="row"><div>Total simulaciones</div><div>{total}</div></div>
                  <div className="row"><div>Cerradas</div><div>{closedSims.length}</div></div>
                  <div className="row"><div className="green">Ganadas</div><div className="green">{wins}</div></div>
                  <div className="row"><div className="red">Perdidas</div><div className="red">{losses}</div></div>
                  <div className="row"><div>Win rate</div><div>{winRate.toFixed(1)}%</div></div>
                  <div className="row"><div>Promedio %</div><div>{avgProfit.toFixed(2)}%</div></div>
                  <div className="row"><div>Mejor %</div><div className="green">{best.toFixed(2)}%</div></div>
                  <div className="row"><div>Peor %</div><div className="red">{worst.toFixed(2)}%</div></div>
                </div>
              )}

              {view === 'errores' && (
                <div>
                  {simulations.slice().reverse().filter(s => s.closed && !s.success).map((e, i) => (
                    <div key={i} className="row">
                      <div>
                        <div style={{ fontSize: 13 }}>{e.timestamp}</div>
                        <div className="small">Pred:{e.trend} • pct:{(e.resultPct ?? computeProfitPct(e)).toFixed(2)}%</div>
                      </div>
                      <div className="small">❌</div>
                    </div>
                  ))}
                  {simulations.filter(s => s.closed && !s.success).length === 0 && <div className="small">Aún no hay errores registrados.</div>}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 12 }} />

          {/* Noticias */}
          <div className="section-title">Noticias recientes (Bitcoin)</div>
          <div className="pred-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="small">Fuente: servidor (/news)</div>
              <div>
                <button className="controls" onClick={() => loadNews()} disabled={newsLoading}>
                  {newsLoading ? 'Cargando...' : 'Actualizar noticias'}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {newsError && <div className="red">Error: {newsError}</div>}
              {!news && !newsError && <div className="small">No se encontraron noticias.</div>}
              {Array.isArray(news) && news.length === 0 && <div className="small">Sin noticias disponibles.</div>}
              {Array.isArray(news) && news.slice(0, 6).map((n: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div className="small">{n.source ?? ''} {n.publishedAt ? '• ' + n.publishedAt : ''}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}