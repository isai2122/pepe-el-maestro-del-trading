// server/utils/logger.ts
import * as fs from 'fs';
import * as path from 'path';

type LevelName = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

const LEVEL_ORDER: Record<LevelName, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL_ENV = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LevelName;
const ACTIVE_LEVEL: LevelName = (['ERROR', 'WARN', 'INFO', 'DEBUG'] as LevelName[]).includes(LOG_LEVEL_ENV)
  ? LOG_LEVEL_ENV
  : 'INFO';

/** Evitar import.meta: usar proceso runtime */
const runtimeFile = (typeof process !== 'undefined' && process.argv && process.argv[1])
  ? String(process.argv[1])
  : '';
const RUNTIME_DIR = runtimeFile ? path.dirname(runtimeFile) : process.cwd();

const LOG_DIR = path.join(RUNTIME_DIR, 'server', 'logs'); // server/logs
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por archivo
const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

function ensureDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (_) { /* noop */ }
}

function todayStrUTC() {
  const parts = DATE_FMT.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value || '0000';
  const m = parts.find(p => p.type === 'month')?.value || '00';
  const d = parts.find(p => p.type === 'day')?.value || '00';
  return `${y}-${m}-${d}`;
}

function currentLogFile() {
  return path.join(LOG_DIR, `server-${todayStrUTC()}.log`);
}

function rotateIfNeeded(file: string) {
  try {
    if (!fs.existsSync(file)) return;
    const { size } = fs.statSync(file);
    if (size <= MAX_FILE_SIZE) return;
    const backup = path.join(
      LOG_DIR,
      `server-${todayStrUTC()}-${Date.now()}.log`,
    );
    fs.renameSync(file, backup);
  } catch (_) { /* noop */ }
}

function safeStringify(obj: unknown) {
  try { return JSON.stringify(obj); } catch { return '"<unserializable>"'; }
}

function formatLine(level: LevelName, msg: string, ctx?: Record<string, any>) {
  const base = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx && typeof ctx === 'object' ? ctx : {}),
  };

  if (ENV === 'development') {
    const ctxStr = ctx && Object.keys(ctx).length ? ` ${safeStringify(ctx)}` : '';
    return `[${base.ts}] [${level}] ${msg}${ctxStr}\n`;
  }

  return `${JSON.stringify(base)}\n`;
}

function write(line: string) {
  try {
    ensureDir();
    const file = currentLogFile();
    rotateIfNeeded(file);
    fs.appendFileSync(file, line, 'utf8');
  } catch (_) {
    try { process.stdout.write(line); } catch { /* nothing */ }
  }
}

function levelEnabled(level: LevelName) {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[ACTIVE_LEVEL];
}

function logBase(level: LevelName, msg: string, ctx?: Record<string, any>) {
  if (!levelEnabled(level)) return;
  const line = formatLine(level, msg, ctx);
  write(line);
}

export const logger = {
  error: (msg: string, ctx?: Record<string, any>) => logBase('ERROR', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, any>) => logBase('WARN',  msg, ctx),
  info:  (msg: string, ctx?: Record<string, any>) => logBase('INFO',  msg, ctx),
  debug: (msg: string, ctx?: Record<string, any>) => logBase('DEBUG', msg, ctx),

  with: (ctxFixed: Record<string, any>) => ({
    error: (msg: string, ctx?: Record<string, any>) =>
      logBase('ERROR', msg, { ...ctxFixed, ...(ctx || {}) }),
    warn: (msg: string, ctx?: Record<string, any>) =>
      logBase('WARN', msg, { ...ctxFixed, ...(ctx || {}) }),
    info: (msg: string, ctx?: Record<string, any>) =>
      logBase('INFO', msg, { ...ctxFixed, ...(ctx || {}) }),
    debug: (msg: string, ctx?: Record<string, any>) =>
      logBase('DEBUG', msg, { ...ctxFixed, ...(ctx || {}) }),
  }),

  time: (label: string) => {
    const start = process.hrtime.bigint();
    return {
      end: (ctx?: Record<string, any>) => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;
        logBase('DEBUG', `timer:${label}`, { ms: Math.round(ms * 1000) / 1000, ...(ctx || {}) });
        return ms;
      },
    };
  },
};

export const log = (msg: string) => logger.info(msg);
