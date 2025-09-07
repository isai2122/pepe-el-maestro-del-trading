Professional Trading AI — Vite + React (BTC/USDT 1h)
-------------------------------------------------

How to run:
1. Unzip this archive or navigate into the folder.
2. Install dependencies:
   npm install
3. Start dev server:
   npm run dev

What's new (added):
- Backtesting tool: src/backtest.js with an exported runBacktest(...) function.
  Example usage in browser console (after starting app):
    import('/src/backtest.js').then(mod => mod.runBacktest('BTCUSDT', '1h', null, null)).then(res => console.log(res))

- TypeScript scaffold: tsconfig.json added and a TSX wrapper (src/ProfessionalTradingAI.tsx) that re-exports the JS component for progressive migration.
  To use TypeScript fully, install types and rename files as needed. The project currently runs as JavaScript but includes a starter TSX file.

- README and usage notes updated here.

Backtesting notes:
- The backtest fetches up to 1000 hourly candles from Binance REST API per call (public endpoint).
- It predicts on candle i using previous candles and simulates entry at close(i) and exit at close(i+1).
- Results include winrate, average return, and detailed trades.

TypeScript notes:
- tsconfig.json uses allowJs so you can incrementally migrate files to .tsx/.ts.
- A basic ProfessionalTradingAI.tsx wrapper is included so TypeScript-aware editors recognize the component.

Model & Learning:
- The learning logic is heuristic and updates model weights based on successes/failures.
- Model state persists in localStorage under key: ptai_btc_models_v1

Important:
- This tool simulates trades only; it does not execute real orders.
- Binance may limit API usage: for heavy backtesting use a server-side approach or request historical data in batches.

If you want, I can now:
- Convert the core component fully to TypeScript (.tsx) with types (next step).
- Add a UI panel to run backtests directly from the app and visualize results.
- Integrate news fetching into the app to include sentiment as a feature.



Additional features added:
- UI Backtest panel (BacktestPanel.jsx)
- News panel fetching NewsAPI or CoinDesk RSS (NewsPanel.jsx)
- .env.example included for VITE_NEWS_API_KEY


Server usage:
- Run the background server to keep learning while the page is closed:
  cd server
  npm install (from project root) will have installed server deps already
  npm run server
- Or run with pm2: pm2 start server/server.js --name ptai-server
- The server exposes endpoints: /state, /model, /simulations, /pending, /config (POST), /train (POST), /backtest

