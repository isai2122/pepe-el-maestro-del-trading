import React from 'react'
import ProfessionalTradingAI from './ProfessionalTradingAI'
import BacktestPanel from './BacktestPanel'
import NewsPanel from './NewsPanel'

export default function App(){
  return (
    <div>
      <ProfessionalTradingAI />
      <div style={{maxWidth:1100,margin:'18px auto',padding:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:'rgba(255,255,255,0.02)',padding:12,borderRadius:10}}>
            <BacktestPanel />
          </div>
          <div style={{background:'rgba(255,255,255,0.02)',padding:12,borderRadius:10}}>
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
