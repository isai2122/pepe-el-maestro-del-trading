import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * HistoryAndAccounts (robusto contra "Failed to fetch")
 * -----------------------------------------------------
 * Mejoras realizadas en esta versión:
 *  - Intentos con varias bases (incluye mismo origen y /api)
 *  - Uso de new URL para construir URLs de manera segura
 *  - Timeout + AbortController para evitar colgar la UI
 *  - Fallback a localStorage (modo offline) y datos mock
 *  - Mensajes UI claros cuando la API no responde
 *  - Protección contra entornos sin localStorage
 *  - Manejo seguro de setInterval + captura de errores
 *  - No reemplaza archivos existentes: este componente es 100% adicional.
 *
 * Recomendación rápida (antes de ejecutar):
 *  1) Asegúrate de que el *backend* esté arrancado (ej. `node server/index.js` o `npm run server`).
 *  2) Si tu servidor corre en otro host/puerto, fija VITE_API_BASE en .env (ej: VITE_API_BASE=http://localhost:4000)
 *  3) Si usas proxy en Vite, /api debe estar mapeado a tu backend.
 */

// Candidatos de API base (ordenados). NOTA: mantenemos la cadena vacía '' para probar mismo origen.
const ENV_BASE = (import.meta as any)?.env?.VITE_API_BASE as string | undefined
const WIN_BASE = (globalThis as any)?.__API_BASE__ as string | undefined
const rawCandidates = [ENV_BASE, WIN_BASE, '', '/api', 'http://localhost:4000', 'http://127.0.0.1:4000']
const CANDIDATE_BASES = Array.from(new Set(rawCandidates.filter((c) => c !== undefined))) as string[]

// Tipos
export type Trend = 'UP' | 'DOWN' | 'NEUTRAL'
export interface Simulation {
  id: string
  entryTime: string
  exitTime: string | null
  entryPrice: number
  exitPrice: number | null
  trend: Trend // dirección
  probability?: number
  probUp?: number
  probDown?: number
  confidence?: number
  closed?: boolean
  reasoning?: string[]
}
export interface LearningItem {
  id?: string
  timestamp: string
  predicted: Trend
  actual: Trend
  reason?: string
  indicators?: Record<string, any>
  correct?: boolean
  actualPct?: number
}

// Helpers
function pctFor(sim: Simulation): number | null {
  if (sim.exitPrice == null || sim.exitTime == null) return null
  const { entryPrice, exitPrice, trend } = sim
  if (trend === 'UP') return ((exitPrice - entryPrice) / entryPrice) * 100
  if (trend === 'DOWN') return ((entryPrice - exitPrice) / entryPrice) * 100
  return 0
}
function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(2)}%`
}
function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

// Seguridad para localStorage en entornos no browser
function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined'
  } catch { return false }
}

// Fetch robusto con timeout (construcción de URL segura)
async function tryFetchJSON(base: string | undefined, path: string, timeoutMs = 4000): Promise<any | null> {
  // Construimos URL de forma robusta:
  let url: string
  try {
    if (!base || base === '') {
      // mismo origen
      url = new URL(path, window.location.origin).toString()
    } else if (base.startsWith('http://') || base.startsWith('https://')) {
      url = new URL(path, base).toString()
    } else {
      // relativo como '/api' -> combinar con origin
      url = new URL(base.replace(/\/$/, '') + path, window.location.origin).toString()
    }
  } catch (e) {
    // Si la construcción falla (p.ej. base inválida), devolvemos null para intentar otro candidato
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'same-origin', mode: 'cors' })
    if (!res.ok) return null
    const json = await res.json()
    return json
  } catch (err) {
    // Falló la petición (network / CORS / abort). Caller intentará otra base o fallback.
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function smartFetchJSON(path: string): Promise<{ json: any | null; baseUsed: string | null; tried: string[] }> {
  const tried: string[] = []
  for (const base of CANDIDATE_BASES) {
    tried.push(String(base ?? ''))
    const json = await tryFetchJSON(base, path)
    if (json != null) return { json, baseUsed: base ?? null, tried }
  }
  return { json: null, baseUsed: null, tried }
}

// Persistencia local
const LS_SIMS = 'PTAIF_SIM_HISTORY'
const LS_LEARN = 'PTAIF_LEARNING_HISTORY'
function getLocal<T>(key: string, fallback: T): T {
  if (!hasLocalStorage()) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function setLocal<T>(key: string, value: T) {
  if (!hasLocalStorage()) return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// Mocks
const MOCK_SIMS: Simulation[] = [
  {
    id: 'mock-1',
    entryTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    exitTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    entryPrice: 100,
    exitPrice: 103,
    trend: 'UP',
    probUp: 62,
    probDown: 38,
    confidence: 0.82,
    closed: true,
    reasoning: ['SMA rápida > lenta', 'MACD positivo'],
  },
]

export default function HistoryAndAccounts() {
  const [tab, setTab] = useState<'historial' | 'cuentas' | 'errores'>('historial')
  const [sims, setSims] = useState<Simulation[]>([])
  const [learning, setLearning] = useState<LearningItem[]>([])
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [apiBaseUsed, setApiBaseUsed] = useState<string | null>(null)
  const [lastTried, setLastTried] = useState<string[] | null>(null)
  const timerRef = useRef<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      // Si el navegador está offline, vamos directo a localStorage
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const saved = getLocal<Simulation[]>(LS_SIMS, MOCK_SIMS)
        setSims(saved.slice().reverse())
        setLearning(getLocal<LearningItem[]>(LS_LEARN, []))
        setOffline(true)
        return
      }

      // 1) Intentar /simulations
      let items: Simulation[] | null = null
      let baseUsed: string | null = null
      let triedBases: string[] = []

      const res1 = await smartFetchJSON('/simulations?limit=500')
      triedBases = res1.tried
      if (res1.json && (Array.isArray(res1.json) || Array.isArray(res1.json.items))) {
        items = (res1.json.items ?? res1.json) as Simulation[]
        baseUsed = res1.baseUsed
      }

      // 2) Fallback a /state
      if (!items) {
        const res2 = await smartFetchJSON('/state')
        triedBases = triedBases.concat(res2.tried)
        if (res2.json && (Array.isArray(res2.json) || Array.isArray(res2.json.items) || Array.isArray(res2.json.simulations))) {
          items = (res2.json.simulations ?? res2.json.items ?? res2.json) as Simulation[]
          baseUsed = res2.baseUsed ?? baseUsed
        }
      }

      let usedOffline = false
      if (!items) {
        // No hubo respuesta de la API
        const local = getLocal<Simulation[]>(LS_SIMS, MOCK_SIMS)
        items = local
        usedOffline = true
      }

      // Normalizar
      const normalized = (items || []).map((s: any, i: number) => ({
        id: String(s.id ?? `${s.entryTime ?? 't'}-${i}`),
        entryTime: s.entryTime ?? new Date().toISOString(),
        exitTime: s.exitTime ?? null,
        entryPrice: Number(s.entryPrice ?? 0),
        exitPrice: s.exitPrice == null ? null : Number(s.exitPrice),
        trend: (s.trend ?? 'NEUTRAL') as Trend,
        probUp: typeof s.probUp === 'number' ? s.probUp : (typeof s.probability === 'number' ? s.probability : undefined),
        probDown: typeof s.probDown === 'number' ? s.probDown : (typeof s.probability === 'number' ? 100 - s.probability : undefined),
        confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
        closed: s.closed ?? (s.exitTime != null),
        reasoning: Array.isArray(s.reasoning) ? s.reasoning : undefined,
      }))

      setSims(normalized.slice().reverse())
      setLocal(LS_SIMS, normalized)
      setOffline(usedOffline)
      setApiBaseUsed(baseUsed)
      setLastTried(Array.from(new Set(triedBases)))

      // 4) Errores/aprendizaje
      let lessons: LearningItem[] | null = null
      const res3 = await smartFetchJSON('/learning?limit=200')
      if (res3.json && (Array.isArray(res3.json) || Array.isArray(res3.json.items))) {
        lessons = (res3.json.items ?? res3.json) as LearningItem[]
      }
      if (!lessons) {
        lessons = normalized
          .filter((s) => {
            const p = pctFor(s)
            return p !== null && p < 0
          })
          .map((s, idx) => ({
            id: `${s.id || idx}`,
            timestamp: s.exitTime || s.entryTime,
            predicted: s.trend,
            actual: s.trend === 'UP' ? 'DOWN' : 'UP',
            reason: 'Derivado automáticamente por pérdida (fallback)',
            correct: false,
            actualPct: pctFor(s) ?? undefined,
          }))
      }
      setLearning(lessons)
      setLocal(LS_LEARN, lessons)

    } catch (err) {
      // Si algo inesperado sucede, caemos a modo offline pero no rompemos la UI
      console.error('HistoryAndAccounts load error:', err)
      const local = getLocal<Simulation[]>(LS_SIMS, MOCK_SIMS)
      setSims(local.slice().reverse())
      setLearning(getLocal<LearningItem[]>(LS_LEARN, []))
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Llamada inicial
    load().catch((e) => console.error('Inicial load error:', e))
    // refresco cada 30s
    timerRef.current = window.setInterval(() => {
      load().catch((e) => console.error('Periodic load error:', e))
    }, 30000) as any
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [])

  const { wins, losses, total, winRate } = useMemo(() => {
    let w = 0, l = 0, t = 0
    for (const s of sims) {
      const pct = pctFor(s)
      if (pct === null) continue
      t++
      if (pct >= 0) w++
      else l++
    }
    const wr = t > 0 ? (w / t) * 100 : 0
    return { wins: w, losses: l, total: t, winRate: wr }
  }, [sims])

  return (
    <div style={{ width: '100%' }}>
      {/* Encabezado */}
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: 8 }}>
        <button onClick={() => setTab('historial')} className="controls" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: tab==='historial' ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'inherit' }}>Historial</button>
        <button onClick={() => setTab('cuentas')} className="controls" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: tab==='cuentas' ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'inherit' }}>Cuentas</button>
        <button onClick={() => setTab('errores')} className="controls" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: tab==='errores' ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'inherit' }}>Errores</button>
        <div className="small" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading ? 'Actualizando…' : ''}
          <button className="controls" onClick={() => load().catch((e) => console.error(e))} style={{ padding: '4px 8px', borderRadius: 6 }}>Recargar</button>
        </div>
      </div>

      {offline && (
        <div className="card" style={{ padding: 8, marginBottom: 10 }}>
          <div className="small">⚠️ Modo offline: no se pudo contactar la API. Mostrando datos guardados localmente.</div>
          <div className="small">Bases intentadas: {lastTried ? lastTried.join(' • ') : '—'}</div>
          <div className="small">Base usada: {apiBaseUsed ?? '—'}</div>
          <div className="small">Consejo: arranca el backend o configura VITE_API_BASE con la URL correcta.</div>
        </div>
      )}

      {/* Contenido */}
      {tab === 'historial' && (
        <div className="card" style={{ padding: 10, maxHeight: 420, overflowY: 'auto' }}>
          <div className="section-title">Historial de simulaciones</div>
          {sims.length === 0 && (
            <div className="small">Aún no hay simulaciones.</div>
          )}
          {sims.map((s) => {
            const pct = pctFor(s)
            const badge = s.trend === 'UP' ? 'SUBIDA' : s.trend === 'DOWN' ? 'BAJADA' : 'NEUTRO'
            const probUp = typeof s.probUp === 'number' ? s.probUp : (typeof (s as any).probability === 'number' ? (s as any).probability : null)
            const probDown = typeof s.probDown === 'number' ? s.probDown : (typeof (s as any).probability === 'number' ? 100 - (s as any).probability : null)
            return (
              <div key={s.id} className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{badge}</div>
                  <div className="small">Entrada: ${formatNumber(s.entryPrice)} • Salida: {s.exitTime ? `$${formatNumber(s.exitPrice)}` : '—'} • Resultado: {formatPct(pct)}</div>
                  <div className="small">Prob subida: {probUp != null ? `${probUp.toFixed(2)}%` : '—'} • Prob bajada: {probDown != null ? `${(probDown as number).toFixed(2)}%` : '—'}</div>
                  <div className="small">Apertura: {new Date(s.entryTime).toLocaleString()}</div>
                  {s.exitTime && <div className="small">Cierre: {new Date(s.exitTime).toLocaleString()}</div>}
                  {Array.isArray(s.reasoning) && s.reasoning.length > 0 && (
                    <div className="small">Razón: {s.reasoning.slice(0, 3).join(' • ')}</div>
                  )}
                </div>
                <div className="small" style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>{pct != null ? (pct >= 0 ? '✅ Ganancia' : '❌ Pérdida') : 'Abierta'}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'cuentas' && (
        <div className="card" style={{ padding: 10 }}>
          <div className="section-title">Cuentas</div>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><div>Total de simulaciones cerradas</div><div className="small">{total}</div></div>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><div>Ganadas</div><div className="green">{wins} ({((wins/(total||1))*100).toFixed(1)}%)</div></div>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><div>Perdidas</div><div className="red">{losses} ({((losses/(total||1))*100).toFixed(1)}%)</div></div>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><div>Win Rate</div><div className="small">{winRate.toFixed(1)}%</div></div>
        </div>
      )}

      {tab === 'errores' && (
        <div className="card" style={{ padding: 10, maxHeight: 420, overflowY: 'auto' }}>
          <div className="section-title">Historial de errores y aprendizaje</div>
          {learning.length === 0 && <div className="small">Sin errores registrados.</div>}
          {learning.map((e, idx) => (
            <div key={e.id || idx} className="row" style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Lección #{idx + 1}</div>
                <div className="small">Predijo: {e.predicted} • Real: {e.actual} • Resultado: {e.correct ? '✅ Correcta' : '❌ Incorrecta'} {e.actualPct != null ? `(${formatPct(e.actualPct)})` : ''}</div>
                <div className="small">{new Date((e as any).timestamp || Date.now()).toLocaleString?.() || (e as any).timestamp}</div>
                {e.reason && <div className="small">Aprendizaje: {e.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Tarjeta simple reusada (no export)
function Card({ title, value, footer }: { title: string, value: React.ReactNode, footer?: string }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="small">{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {footer && <div className="small">{footer}</div>}
    </div>
  )
}

// Auto-tests ligeros (solo en dev)
function runSelfTests() {
  const a: Simulation = { id: 't1', entryTime: 'x', exitTime: 'y', entryPrice: 100, exitPrice: 110, trend: 'UP' }
  console.assert(Math.abs((pctFor(a) ?? 0) - 10) < 1e-6, 'pctFor UP debe ser 10%')
  const b: Simulation = { id: 't2', entryTime: 'x', exitTime: 'y', entryPrice: 100, exitPrice: 90, trend: 'DOWN' }
  console.assert(Math.abs((pctFor(b) ?? 0) - 10) < 1e-6, 'pctFor DOWN debe ser 10%')
  console.assert(formatNumber(12.3456) === '12.35', 'formatNumber redondea a 2')
  console.assert(formatPct(3.456) === '3.46%', 'formatPct redondea a 2 con %')
}
if ((import.meta as any)?.env?.MODE !== 'production') {
  try { runSelfTests() } catch {}
}