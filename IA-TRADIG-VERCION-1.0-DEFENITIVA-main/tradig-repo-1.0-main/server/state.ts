// server/state.ts
import fs from 'fs';
import path from 'path';
import type { ServerState } from './types.js';

const runtimeFile = (typeof process !== 'undefined' && process.argv && process.argv[1])
  ? String(process.argv[1])
  : '';
const RUNTIME_DIR = runtimeFile ? path.dirname(runtimeFile) : process.cwd();

const DATA_DIR = path.join(RUNTIME_DIR, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MODELS_FILE = path.join(RUNTIME_DIR, 'models.json');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_STATE: ServerState = {
  config: {
    simulationIntervalSec: 300,
    analysisIntervalSec: 30,
  },
  model: {
    wSma: 0.3,
    wRsi: 0.2,
    wMacd: 0.3,
    wBoll: 0.15,
    wVol: 0.05,
  },
  pending: null,
  simulations: [],
  learningErrors: [],
  news: []
};

function isPlainObject(v: any) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function normalizeLoadedState(raw: any): ServerState {
  if (!isPlainObject(raw)) return { ...DEFAULT_STATE };

  const merged: ServerState = {
    ...DEFAULT_STATE,
    ...raw,
    config: { ...DEFAULT_STATE.config, ...(raw.config || {}) },
    model: { ...(isPlainObject(raw.model) ? raw.model : DEFAULT_STATE.model) },
    pending: raw.pending ?? DEFAULT_STATE.pending,
    simulations: Array.isArray(raw.simulations) ? raw.simulations : [],
    learningErrors: Array.isArray(raw.learningErrors) ? raw.learningErrors : [],
  };

  merged.simulations = merged.simulations || [];
  merged.learningErrors = merged.learningErrors || [];

  return merged;
}

export function loadState(): ServerState {
  ensureDataDir();

  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return normalizeLoadedState(parsed);
    } catch (err) {
      console.error('loadState parse error, returning defaults and rewriting state file:', err);
      try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
      } catch (e) {
        console.error('failed to rewrite default state file:', e);
      }
      return { ...DEFAULT_STATE };
    }
  }

  if (fs.existsSync(MODELS_FILE)) {
    try {
      const raw = fs.readFileSync(MODELS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const merged: ServerState = {
        ...DEFAULT_STATE,
        ...parsed,
        config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) },
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf8');
      return merged;
    } catch (err) {
      console.error('failed to load models.json, falling back to DEFAULT_STATE:', err);
      return { ...DEFAULT_STATE };
    }
  }

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  } catch (err) {
    console.error('save initial state error:', err);
  }

  return { ...DEFAULT_STATE };
}

export function saveState(s: ServerState) {
  try {
    ensureDataDir();
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error('atomic save failed, trying direct write:', err);
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
    } catch (e) {
      console.error('direct saveState failed:', e);
    }
  }
}
