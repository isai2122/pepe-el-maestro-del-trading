// server/index.ts
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { loadState as loadStateFromFile } from './state.js';
import { predict } from './model.js';
import { runBacktest } from './backtest.js';
import { trainGrid } from './train.js';
import { log } from './utils/logger.js';
import type {
  Candle,
  Simulation,
  ServerState,
  Trend,
  NewsItem,
  Model as CoreModel,
} from './types.js';

import fetch from 'node-fetch'; // asume "esModuleInterop": true en tsconfig

const writeFile = promisify(fs.writeFile);
const rename = promisify(fs.rename);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

/** Evitar import.meta — fallback compatible CommonJS/ESM */
const runtimeFile = (typeof process !== 'undefined' && process.argv && process.argv[1])
  ? String(process.argv[1])
  : '';
const RUNTIME_DIR = runtimeFile ? path.dirname(runtimeFile) : process.cwd();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Runtime config
const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.join(RUNTIME_DIR, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const NEWS_CACHE_FILE = path.join(DATA_DIR, 'news.json');
const SAVE_DEBOUNCE_MS = 500;
const DEFAULT_SIM_INTERVAL_SEC = 300;
const DEFAULT_ANALYSIS_INTERVAL_SEC = 30;
const NEWS_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h

console.log(`DEBUG: starting server file. PORT=${PORT} NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}`);

// Estado en memoria
let STATE: ServerState = safeLoadState();
if (!STATE.news) STATE.news = [];
let CANDLES: Candle[] = [];

// Guardado atómico con debounce
let pendingSave = false;
let saveTimeout: NodeJS.Timeout | null = null;
let saving = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}


function safeLoadState(): ServerState {
  try {
    const st = loadStateFromFile();
    log('State loaded from state module');
    return st;
  } catch (e: any) {
    log('loadState failed, creating fallback initial state: ' + (e?.message || String(e)));
    const init: ServerState = {
      config: {
        simulationIntervalSec: DEFAULT_SIM_INTERVAL_SEC,
        analysisIntervalSec: DEFAULT_ANALYSIS_INTERVAL_SEC,
      },
      model: { wSma: 0.3, wRsi: 0.2, wMacd: 0.3, wBoll: 0.15, wVol: 0.05 },
      pending: null,
      simulations: [],
      learningErrors: [],
      news: []
    };
    try {
      ensureDataDir();
      saveStateSync(init);
    } catch (err) {
      log('Failed to persist initial state: ' + String(err));
    }
    return init;
  }
}

function saveStateDebounced(state?: ServerState) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStateAtomic(state ?? STATE).catch(err =>
      log('saveStateDebounced error: ' + String(err)),
    );
  }, SAVE_DEBOUNCE_MS);
}

async function saveStateAtomic(state: ServerState) {
  if (saving) {
    pendingSave = true;
    return;
  }
  saving = true;
  try {
    ensureDataDir();
    const tmp = STATE_FILE + '.tmp';
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await rename(tmp, STATE_FILE);
    log('State saved atomically');
  } catch (err: any) {
    log('saveStateAtomic error: ' + (err?.message || String(err)));
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
      log('State saved via direct write fallback');
    } catch (e: any) {
      log('saveStateAtomic direct write failed: ' + (e?.message || e));
    }
  } finally {
    saving = false;
    if (pendingSave) {
      pendingSave = false;
      await saveStateAtomic(state);
    }
  }
}

function saveStateSync(state: ServerState) {
  ensureDataDir();
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

function normalizeTrend(t: string | undefined): Trend {
  if (!t) return 'NEUTRAL';
  const up = String(t).toUpperCase();
  if (['UP', 'ARRIBA', 'SUBIR'].includes(up)) return 'UP';
  if (['DOWN', 'ABAJO', 'BAJAR'].includes(up)) return 'DOWN';
  return 'NEUTRAL';
}

function ensureModelDefaults(m: Partial<CoreModel> | undefined): CoreModel {
  const base = m || {};
  return {
    wSma: base.wSma ?? 0.3,
    wRsi: base.wRsi ?? 0.2,
    wMacd: base.wMacd ?? 0.3,
    wBoll: base.wBoll ?? 0.15,
    wVol: base.wVol ?? 0.05,
  } as CoreModel;
}

function pushSyntheticCandle() {
  const last = CANDLES[CANDLES.length - 1];
  const now = Date.now();
  const base = last ? last.close : 60000;
  const change = (Math.random() - 0.5) * 200;
  const open = base;
  const close = Math.max(1, base + change);
  const high = Math.max(open, close) + Math.random() * 50;
  const low = Math.min(open, close) - Math.random() * 50;
  const vol = 100 + Math.random() * 100;
  const candle: Candle = {
    openTime: now,
    open,
    high,
    low,
    close,
    volume: vol,
    closeTime: now + 60000,
  };
  CANDLES.push(candle);
  if (CANDLES.length > 2000) CANDLES.shift();
}

setInterval(() => {
  try {
    if (CANDLES.length < 80) {
      for (let i = 0; i < 120; i++) pushSyntheticCandle();
      log('Synthetic seed candles generated: ' + CANDLES.length);
    }
  } catch (err: any) {
    log('Synthetic error ' + (err?.message || err));
  }
}, 2000);

// Scheduler, news fetch, endpoints, etc. (puedes mantener el resto del archivo tal cual)


/** ================= Dynamic Analysis Scheduler ================= */
function scheduleAnalysis() {
  const interval = (STATE.config.analysisIntervalSec || DEFAULT_ANALYSIS_INTERVAL_SEC) * 1000;
  setTimeout(() => {
    try {
      // ✅ Cambio: predict ahora recibe STATE completo
      const p = predict(STATE);
      const trend = normalizeTrend((p as any).trend);
      STATE.pending = { ...(p as any), trend };

      const c = CANDLES[CANDLES.length - 1];
      if (c) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const sim: Simulation = {
          id,
          entryTime: new Date(c.closeTime).toISOString(),
          exitTime: null,
          entryPrice: c.close,
          exitPrice: null,
          trend,
          probability:
            (p as any)?.probability?.up ??
            (typeof (p as any)?.probability === 'number' ? (p as any).probability : 0),
          confidence: (p as any)?.confidence ?? 0,
          entryMethod: 'analysis-interval',
          closed: false,
          reasoning: (p as any)?.reasoning ?? [],
        };
        STATE.simulations.push(sim);
        if (STATE.simulations.length > 10000) STATE.simulations = STATE.simulations.slice(-8000);
        saveStateDebounced();
        log(`Analysis created simulation ${id} trend=${trend}`);
      }
    } catch (e: any) {
      log('Analysis scheduler error: ' + (e?.message || e));
    }
    scheduleAnalysis();
  }, interval);
}
scheduleAnalysis();

// ... (el resto del archivo sigue igual, no se tocó nada más)

/** ================= Auto-Close + Auto-Train ================= */
setInterval(() => {
  try {
    const now = Date.now();
    const open = STATE.simulations.filter(s => !s.closed);

    for (const s of open) {
      const entryMs = new Date(s.entryTime).getTime();
      if (
        now - entryMs >
        (STATE.config.simulationIntervalSec || DEFAULT_SIM_INTERVAL_SEC) * 1000
      ) {
        const last = CANDLES[CANDLES.length - 1];
        const exitPrice =
          last?.close ?? s.entryPrice * (1 + (Math.random() - 0.5) * 0.002);

        s.exitPrice = exitPrice;
        s.exitTime = new Date().toISOString();

        const ret =
          s.trend === 'UP'
            ? (exitPrice - s.entryPrice) / s.entryPrice
            : (s.entryPrice - exitPrice) / s.entryPrice;

        s.profitPct = ret * 100;
        s.profitAmount = ret * s.entryPrice;
        s.success = ret > 0;
        s.closed = true;

        STATE.learningErrors.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          simId: s.id,
          predicted: s.trend,
          actual: s.success ? 'WIN' : 'LOSS',
          profitPct: s.profitPct ?? 0,
          createdAt: new Date().toISOString(),
          notes: s.success
            ? 'Predicción correcta'
            : 'Predicción incorrecta → analizar y ajustar',
        });

        // ===== Auto-train (corrección de tipos mínima y segura) =====
        try {
          const modelForTraining = ensureModelDefaults(STATE.model as Partial<CoreModel>);
          const best = trainGrid(modelForTraining as any, CANDLES); // cast puntual para evitar choque de tipos
          STATE.model = best.model as any;
          log('Auto-trained model after simulation close');
        } catch (trainErr: any) {
          log('Auto-train error: ' + (trainErr?.message || trainErr));
        }

        saveStateDebounced();
        log(
          `Closed sim ${s.id} ${s.success ? 'WIN' : 'LOSS'} profitPct=${
            s.profitPct?.toFixed(2)
          }`,
        );
      }
    }
  } catch (err: any) {
    log('Error closing simulations: ' + (err?.message || err));
  }
}, 5000);

/** ===================== NEWS AGGREGATOR (inlined) ===================== **
 * - Fetch RSS/Atom/HTML feeds (best-effort)
 * - Parse titles/links/dates
 * - Simple sentiment/impact heuristics (no external ML)
 * - Cache to data/news.json (24h)
 * - Exposes /news endpoint that always returns JSON
 **************************************************************************/

/** Simple feed list (puede ajustarse) */
const NEWS_SOURCES = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://news.google.com/rss/search?q=bitcoin&hl=en-US&gl=US&ceid=US:en',
  'https://www.reuters.com/world/technology/rss',
  'https://www.bloomberg.com/markets/cryptocurrency.rss'
];

/** util: parse RSS/Atom to items */
function parseFeedItems(feedText: string, sourceLabel: string): NewsItem[] {
  const items: NewsItem[] = [];
  if (!feedText) return items;

  const itemBlocks = Array.from(feedText.matchAll(/<item[\s\S]*?<\/item>/gi)).map(m => m[0])
    .concat(Array.from(feedText.matchAll(/<entry[\s\S]*?<\/entry>/gi)).map(m => m[0]));

  for (const block of itemBlocks) {
    let title = '';
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();

    let url = '';
    const linkMatch = block.match(/<link[^>]*>(.*?)<\/link>/i);
    if (linkMatch && linkMatch[1].includes('http')) url = linkMatch[1].trim();
    else {
      const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (hrefMatch) url = hrefMatch[1].trim();
      else {
        const httpMatch = block.match(/https?:\/\/[^\s'"]+/i);
        if (httpMatch) url = httpMatch[0];
      }
    }

    let publishedAt = '';
    const dateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    if (dateMatch) {
      try { publishedAt = new Date(dateMatch[1].trim()).toISOString(); } catch (e) { publishedAt = new Date().toISOString(); }
    } else {
      publishedAt = new Date().toISOString();
    }

    if (title) {
      items.push({
        title,
        source: sourceLabel,
        url,
        publishedAt,
        sentiment: 'neutral',
        impact: 'medio'
      });
    }
  }

  if (!items.length) {
    const titleMatches = Array.from(feedText.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)).map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
    for (let i = 0; i < Math.min(titleMatches.length, 8); i++) {
      const t = titleMatches[i];
      if (t) items.push({ title: t, source: sourceLabel, url: '', publishedAt: new Date().toISOString(), sentiment: 'neutral', impact: 'medio' });
    }
  }

  return items;
}

/** heurística muy simple de sentimiento e impacto */
function analyzeSentimentAndImpact(text: string) {
  const txt = (text || '').toLowerCase();
  const positive = ['gain','gains','bull','rally','surge','soar','record','adoption','partnership','positive','upgrade','beats','beat','growth','approval','legalize','favorable','ease','bullish','uptrend'];
  const negative = ['drop','drops','crash','sell-off','plunge','spike','hack','exploit','fraud','regulation','ban','investigation','inflation','recession','default','war','attack','sanction','negative','downgrade','fall','bearish','downtrend','volatility','sinking'];
  let score = 0;
  for (const w of positive) if (txt.includes(w)) score += 1;
  for (const w of negative) if (txt.includes(w)) score -= 1;

  const sentiment: 'positivo' | 'negativo' | 'neutral' = score > 0 ? 'positivo' : score < 0 ? 'negativo' : 'neutral';

  const longKeywords = ['war','attack','sanction','bankrupt','default','hack','exploit','fraud','regulation','legislation','investigation','sanctions'];
  const shortKeywords = ['rally','surge','crash','plunge','spike','sell-off','volatility','dump','pump','price'];
  let impact: 'corto' | 'medio' | 'largo' = 'medio';
  for (const k of longKeywords) if (txt.includes(k)) { impact = 'largo'; break; }
  if (impact !== 'largo') {
    for (const k of shortKeywords) if (txt.includes(k)) { impact = 'corto'; break; }
  }
  if (Math.abs(score) >= 3) impact = 'largo';

  return { sentiment, impact, score };
}

/** fetch & aggregate */
async function fetchAndAnalyzeNews(): Promise<NewsItem[]> {
  ensureDataDir();
  const gathered: NewsItem[] = [];
  for (const src of NEWS_SOURCES) {
    try {
      const res = await fetch(src, { timeout: 15_000 });
      if (!res || !res.ok) {
        log(`news fetch failed ${src} status=${res ? res.status : 'noresp'}`);
        continue;
      }
      const txt = await res.text();
      const items = parseFeedItems(txt, src);
      for (const it of items) {
        const analysis = analyzeSentimentAndImpact(it.title + ' ' + (it.url || ''));
        (it as any).sentiment = analysis.sentiment;
        (it as any).impact = analysis.impact;
        gathered.push(it);
      }
    } catch (err: any) {
      log('news fetch error for ' + src + ' -> ' + String(err?.message || err));
      continue;
    }
  }

  const map = new Map<string, NewsItem>();
  for (const n of gathered) {
    const key = (n.title || '').trim().toLowerCase() + '|' + (n.url || '').trim();
    if (!map.has(key)) map.set(key, n);
  }
  const uniq = Array.from(map.values());

  uniq.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  try {
    const tmp = NEWS_CACHE_FILE + '.tmp';
    await writeFile(tmp, JSON.stringify({ updatedAt: Date.now(), items: uniq }, null, 2), 'utf8');
    await rename(tmp, NEWS_CACHE_FILE);
  } catch (err: any) {
    log('Failed to write news cache: ' + String(err?.message || err));
  }

  return uniq;
}

/** load cache if <24h otherwise null */
async function loadNewsCacheIfFresh(): Promise<NewsItem[] | null> {
  try {
    const st = await stat(NEWS_CACHE_FILE);
    const age = Date.now() - st.mtimeMs;
    if (age > NEWS_REFRESH_MS) return null;
    const raw = await readFile(NEWS_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) return parsed.items as NewsItem[];
    return null;
  } catch (err) {
    return null;
  }
}

/** refresh helper used at startup + interval */
async function refreshNews(force = false) {
  try {
    if (!force) {
      const cached = await loadNewsCacheIfFresh();
      if (cached && cached.length) {
        STATE.news = cached;
        log(`Using fresh news cache (${cached.length} items)`);
        saveStateDebounced();
        return;
      }
    }
    const news = await fetchAndAnalyzeNews();
    STATE.news = news;
    saveStateDebounced();
    log(`News refreshed (${news.length} items)`);
  } catch (err: any) {
    log('refreshNews error: ' + String(err?.message || err));
  }
}
// initial load (non-blocking)
refreshNews();
// schedule 24h
setInterval(() => refreshNews(false), NEWS_REFRESH_MS);

/** ================= API Endpoints ================= */
// ADDED: root health endpoint simple para comprobar desde navegador
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'professional-trading-ai',
    now: new Date().toISOString(),
    note: 'API backend only — no frontend served'
  });
});

app.get('/health', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));

app.get('/state', (_req, res) =>
  res.json({
    config: STATE.config,
    model: STATE.model,
    pending: STATE.pending,
    stats: {
      total: STATE.simulations.length,
      wins: STATE.simulations.filter(s => s.success).length,
      losses: STATE.simulations.filter(s => s.closed && !s.success).length,
      learning: STATE.learningErrors.length
    }
  })
);

app.get('/simulations', (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 10)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const items = STATE.simulations.slice().reverse().slice(offset, offset + limit);
  res.json({ items, total: STATE.simulations.length });
});

app.get('/pending', (_req, res) => res.json(STATE.pending));

app.get('/learning', (_req, res) =>
  res.json({ items: STATE.learningErrors.slice().reverse(), total: STATE.learningErrors.length })
);

app.get('/stats', (_req, res) => {
  const wins = STATE.simulations.filter(s => s.success).length;
  const losses = STATE.simulations.filter(s => s.closed && !s.success).length;
  res.json({
    total: STATE.simulations.length,
    wins,
    losses,
    winRate: STATE.simulations.length ? (wins / STATE.simulations.length) * 100 : 0
  });
});

// ---- NEWS route: always returns JSON unified (option ?force=1 to refresh)
app.get('/news', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    if (force) await refreshNews(true);
    const items = Array.isArray(STATE.news) ? STATE.news : [];
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ items: [], total: 0, error: String(err?.message || err) });
  }
});

app.post('/config', (req, res) => {
  const { simulationIntervalSec, analysisIntervalSec } = req.body || {};
  if (typeof simulationIntervalSec === 'number') STATE.config.simulationIntervalSec = simulationIntervalSec;
  if (typeof analysisIntervalSec === 'number') STATE.config.analysisIntervalSec = analysisIntervalSec;
  saveStateDebounced();
  res.json({ ok: true, config: STATE.config });
});

app.post('/train', (_req, res) => {
  try {
    const modelForTraining = ensureModelDefaults(STATE.model as Partial<CoreModel>);
    const best = trainGrid(modelForTraining as any, CANDLES); // cast puntual para evitar choque de tipos
    STATE.model = best.model as any;
    saveStateDebounced();
    res.json({ ok: true, best });
  } catch (e: any) {
    log('Train error: ' + (e.message || e));
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/backtest', (req, res) => {
  try {
    const limit = Number(req.query.limit || 500);
    const c = CANDLES.slice(-Math.max(100, limit));
    const r = runBacktest(STATE.model as any, c);
    res.json(r);
  } catch (e: any) {
    log('Backtest error: ' + (e.message || e));
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.post('/evaluate-pending', (_req, res) => {
  try {
    const open = STATE.simulations.filter(s => !s.closed);
    if (!open.length) return res.json({ ok: false, message: 'No open simulations' });
    const s = open[open.length - 1];
    const last = CANDLES[CANDLES.length - 1];
    const exitPrice = last?.close ?? s.entryPrice;
    s.exitPrice = exitPrice;
    s.exitTime = new Date().toISOString();
    const ret =
      s.trend === 'UP'
        ? (exitPrice - s.entryPrice) / s.entryPrice
        : (s.entryPrice - exitPrice) / s.entryPrice;
    s.profitPct = ret * 100;
    s.profitAmount = ret * s.entryPrice;
    s.success = ret > 0;
    s.closed = true;
    saveStateDebounced();
    res.json({ ok: true, closed: s.id });
  } catch (e: any) {
    log('evaluate-pending error: ' + (e.message || e));
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

/** ================= Startup logic ================= */
async function reevalPendingOnStartup() {
  try {
    if (STATE.pending && CANDLES.length) {
      const p = STATE.pending as any;
      const last = CANDLES[CANDLES.length - 1];

      const lastTimeNum = typeof last.closeTime === 'number'
        ? last.closeTime
        : (typeof last.openTime === 'number' ? last.openTime : Date.now());

      const pendingTimeNum = Number(p.time ?? p.timestamp ?? p.createdAt ?? 0);

      if (pendingTimeNum && lastTimeNum > pendingTimeNum) {
        const predictorPrice = Number(p.price ?? 0);
        const basePrice = predictorPrice || last.close;
        const actualPct = ((last.close - basePrice) / (basePrice || last.close)) * 100;

        const pendingSim = STATE.simulations.find(s =>
          !s.closed && Math.abs(s.entryPrice - (Number(p.price ?? 0) || 0)) < 1e-8
        );
        if (pendingSim) {
          pendingSim.exitPrice = last.close;
          pendingSim.exitTime = new Date().toISOString();
          pendingSim.profitPct = actualPct;
          pendingSim.success = (pendingSim.trend === 'UP' && actualPct > 0) || (pendingSim.trend === 'DOWN' && actualPct < 0);
          pendingSim.closed = true;
          STATE.learningErrors.push({
            id: `${Date.now()}-reeval`,
            simId: pendingSim.id,
            predicted: pendingSim.trend,
            actual: pendingSim.success ? 'WIN' : 'LOSS',
            profitPct: pendingSim.profitPct ?? 0,
            createdAt: new Date().toISOString(),
            notes: 'Re-evaluated on startup'
          });
          saveStateDebounced();
          log('Re-evaluated pending simulation on startup: ' + pendingSim.id);
        }
      }
    }
  } catch (e: any) {
    log('reevalPendingOnStartup error: ' + (e.message || e));
  }
}

/** ================= Server init ================= */

// --- Static frontend (Vite build) ---
const CLIENT_DIR = path.resolve(process.cwd(), 'dist', 'client');
try {
  if (fs.existsSync(CLIENT_DIR)) {
    // servir archivos estáticos
    app.use(express.static(CLIENT_DIR));
    // fallback SPA: enviar index.html para rutas no API
    app.get('*', (req, res, next) => {
      const accept = String(req.headers['accept'] || '');
      const isApi = req.path.startsWith('/api/');
      if (!isApi && accept.includes('text/html')) {
        const indexPath = path.join(CLIENT_DIR, 'index.html');
        return res.sendFile(indexPath);
      }
      next();
    });
    console.log('Frontend estático habilitado en', CLIENT_DIR);
  } else {
    console.log('No se encontró build de frontend en', CLIENT_DIR, '— se ejecutará como API-only.');
  }
} catch (e) {
  console.log('Error habilitando frontend estático:', e);
}

app.listen(PORT, async () => {
  // ADDED: imprimir también en consola además de log(...) para ver en terminal
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  log(`🚀 Server listening on http://localhost:${PORT}`);

  // Precargar datos sintéticos si no hay suficiente histórico
  if (CANDLES.length < 80) {
    for (let i = 0; i < 120; i++) pushSyntheticCandle();
  }

  // Cache de noticias si existe
  try {
    const cached = await loadNewsCacheIfFresh();
    if (cached && cached.length) STATE.news = cached;
  } catch (_) { /* ignore */ }

  // Re-evaluar simulaciones pendientes
  await reevalPendingOnStartup();
});

/** ================= Graceful shutdown ================= */
async function shutdown(signal?: string) {
  try {
    log(`Received ${signal || 'shutdown'}, saving state and closing...`);
    await saveStateAtomic(STATE);
    process.exit(0);
  } catch (e: any) {
    log('Shutdown save error: ' + (e.message || e));
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', async (err) => {
  log('uncaughtException: ' + String(err));
  await saveStateAtomic(STATE);
  process.exit(1);
});
process.on('unhandledRejection', async (r) => {
  log('unhandledRejection: ' + String(r));
  await saveStateAtomic(STATE);
  process.exit(1);
});