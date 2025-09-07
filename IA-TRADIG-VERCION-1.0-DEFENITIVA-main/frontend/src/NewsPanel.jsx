import React, { useEffect, useState } from 'react'

/**
 * NewsPanel
 * - Tries to fetch from NewsAPI if VITE_NEWS_API_KEY is provided (recommended)
 * - Otherwise falls back to CoinDesk RSS via allorigins proxy and parses titles
 *
 * To enable richer news, create a file `.env` in project root with:
 *   VITE_NEWS_API_KEY=your_newsapi_key_here
 *
 */

export default function NewsPanel(){
  const [loading, setLoading] = useState(false)
  const [articles, setArticles] = useState([])
  const [error, setError] = useState(null)

  useEffect(()=>{ fetchNews() }, [])

  async function fetchNews(){
    setLoading(true); setError(null)
    try{
      const key = import.meta.env.VITE_NEWS_API_KEY
      if(key){
        const url = `https://newsapi.org/v2/everything?q=bitcoin OR crypto OR btc&sortBy=publishedAt&pageSize=6&language=en&apiKey=${key}`
        const r = await fetch(url)
        if(!r.ok) throw new Error('NewsAPI error: ' + r.status)
        const j = await r.json()
        setArticles(j.articles || [])
      } else {
        // fallback: CoinDesk RSS via allorigins (to avoid CORS)
        const rssUrl = encodeURIComponent('https://www.coindesk.com/arc/outboundfeeds/rss/')
        const proxy = `https://api.allorigins.win/get?url=${rssUrl}`
        const r = await fetch(proxy)
        if(!r.ok) throw new Error('Fallback news fetch failed')
        const txt = await r.json()
        const parser = new DOMParser()
        const doc = parser.parseFromString(txt.contents, 'text/html')
        const items = Array.from(doc.querySelectorAll('item')).slice(0,6)
        const list = items.map(it=>({ title: it.querySelector('title')?.textContent || 'No title', link: it.querySelector('link')?.textContent || '', source: 'CoinDesk RSS' }))
        setArticles(list)
      }
    }catch(e){ setError(String(e)) }
    setLoading(false)
  }

  return (
    <div style={{marginTop:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:700}}>Noticias recientes (Bitcoin)</div>
        <div style={{fontSize:12,color:'#94a3b8'}}>{loading? 'Cargando...' : 'Fuente: NewsAPI/Coindesk'}</div>
      </div>

      {error && <div style={{color:'#fb7185',marginTop:8}}>Error: {error}</div>}

      <div style={{marginTop:8,display:'grid',gap:8}}>
        {articles.length===0 && !loading && <div className="small">No se encontraron noticias.</div>}
        {articles.map((a,i)=>(
          <a key={i} href={a.url || a.link} target="_blank" rel="noreferrer" style={{padding:8,background:'rgba(255,255,255,0.02)',borderRadius:8,textDecoration:'none',color:'inherit'}}>
            <div style={{fontWeight:600}}>{a.title || a.title}</div>
            <div className="small">{a.source?.name || a.source || a.link}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
