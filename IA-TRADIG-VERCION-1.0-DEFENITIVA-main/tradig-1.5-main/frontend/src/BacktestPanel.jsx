import React, { useState } from 'react'

export default function BacktestPanel(){ 
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setRunning(true); setError(null); setResult(null)
    try{
      const mod = await import('./backtest.js')
      const res = await mod.runBacktest('BTCUSDT', '1h', null, null)
      setResult(res)
    }catch(e){ setError(e.message || String(e)) }
    setRunning(false)
  }

  return (
    <div style={{marginTop:12}}>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={run} disabled={running} style={{padding:8,borderRadius:8}}>{running? 'Ejecutando...' : 'Ejecutar Backtest (últimos ~1000 velas)'}</button>
        <div style={{color:'#94a3b8',fontSize:13}}>El backtest usa la API pública de Binance (hasta 1000 velas)</div>
      </div>

      {error && <div style={{marginTop:8,color:'#fb7185'}}>Error: {error}</div>}

      {result && (
        <div style={{marginTop:10}}>
          <div style={{fontWeight:700}}>Resumen:</div>
          <div className="small">Total trades: {result.total} • Wins: {result.wins} • Losses: {result.losses} • Winrate: {result.winrate.toFixed(2)}% • Avg return: {result.avgRet.toFixed(4)}%</div>
          <details style={{marginTop:8}}>
            <summary>Ver trades (console)</summary>
            <div className="small">Se listaron {result.trades.length} trades. Consulta la consola del navegador para ver el array completo.</div>
            <button onClick={()=>{ console.log(result.trades); alert('Trades enviados a la consola') }} style={{marginTop:6,padding:6,borderRadius:6}}>Abrir en consola</button>
          </details>
        </div>
      )}
    </div>
  )
}
