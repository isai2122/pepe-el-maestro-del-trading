import fs from 'fs';
import path from 'path';
import { loadState, saveState } from './state.js';
import type { ServerState } from './types.js';


const DATA_DIR = path.join(__dirname, "data");
const NEWS_FILE = path.join(DATA_DIR, "news.json");

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_API_URL = `https://newsapi.org/v2/everything?q=stocks+finance+crypto&language=en&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`;

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
}

function analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
  const t = text.toLowerCase();
  if (
    t.includes("rise") || t.includes("gain") ||
    t.includes("bull") || t.includes("up") ||
    t.includes("profit")
  ) {
    return "positive";
  }
  if (
    t.includes("fall") || t.includes("drop") ||
    t.includes("bear") || t.includes("down") ||
    t.includes("loss")
  ) {
    return "negative";
  }
  return "neutral";
}

export async function fetchNews() {
  try {
    console.log("[news] Fetching latest news...");

    const res = await fetch(NEWS_API_URL);
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);

    const data = await res.json();
    if (!data.articles || !Array.isArray(data.articles)) return [];

    const news: NewsItem[] = data.articles.map((a: any) => ({
      title: a.title || "",
      description: a.description || "",
      url: a.url || "",
      publishedAt: a.publishedAt || new Date().toISOString(),
      source: a.source?.name || "Unknown",
      sentiment: analyzeSentiment(`${a.title} ${a.description}`),
    }));

    // Cargar histórico existente
    let allNews: NewsItem[] = [];
    if (fs.existsSync(NEWS_FILE)) {
      allNews = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
    }

    // Añadir nuevas noticias al histórico
    allNews = [...news, ...allNews].slice(0, 1000); // limitamos a últimas 1000 noticias

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(NEWS_FILE, JSON.stringify(allNews, null, 2), "utf8");

    // Guardar en state.json también
    const state: ServerState = loadState();
    (state as any).news = allNews;
    saveState(state);

    console.log(`[news] Stored ${news.length} new articles, total: ${allNews.length}`);
    return allNews;
  } catch (err) {
    console.error("[news] fetch failed:", err);
    return [];
  }
}

/**
 * Calcula impacto agregado de noticias
 * - corto plazo: últimas 24h
 * - largo plazo: últimos 7 días
 */
export function getNewsImpact(): { shortTerm: number; longTerm: number } {
  if (!fs.existsSync(NEWS_FILE)) return { shortTerm: 0, longTerm: 0 };

  const allNews: NewsItem[] = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
  const now = new Date();

  const within = (hours: number) =>
    allNews.filter(
      (n) => (now.getTime() - new Date(n.publishedAt).getTime()) / 36e5 <= hours
    );

  const last24h = within(24);
  const last7d = within(24 * 7);

  const score = (arr: NewsItem[]) => {
    if (arr.length === 0) return 0;
    let s = 0;
    for (const n of arr) {
      if (n.sentiment === "positive") s += 1;
      else if (n.sentiment === "negative") s -= 1;
    }
    return s / arr.length; // normalizado entre -1 y +1
  };

  return {
    shortTerm: score(last24h),
    longTerm: score(last7d),
  };
}
