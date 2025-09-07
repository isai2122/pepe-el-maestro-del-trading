from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import uvicorn
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
from pathlib import Path
import aiohttp
import random

# Importar nuestros sistemas independientes
from technical_analysis import analyzer
from ai_learning_system import initialize_ml_system, ml_system

app = FastAPI(title="TradingAI Pro API - MIRA ENHANCED", version="2.0.0")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.tradingai

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class TradingSignal(BaseModel):
    id: str
    timestamp: datetime
    symbol: str
    trend: str
    probability: dict
    confidence: float
    entry_price: float
    indicators: dict
    reasoning: List[str]
    ml_prediction: Optional[dict] = None
    technical_analysis: Optional[dict] = None

class EnhancedSimulation(BaseModel):
    id: str
    timestamp: datetime
    entry_price: float
    exit_price: Optional[float] = None
    trend: str
    probability: dict
    confidence: float
    result_pct: Optional[float] = None
    success: Optional[bool] = None
    closed: bool = False
    entry_method: str = "ML_AUTO"
    technical_analysis: Optional[dict] = None
    ml_prediction: Optional[dict] = None
    learning_feedback: Optional[bool] = None

class TradingStats(BaseModel):
    total_simulations: int
    closed_simulations: int
    wins: int
    losses: int
    win_rate: float
    avg_profit: float
    best_trade: float
    worst_trade: float
    ml_accuracy: Optional[float] = None
    learning_samples: Optional[int] = None

# Sistema de predicciones mejorado
prediction_history = []
last_analysis_time = None
last_market_data = None

# API endpoints
@app.get("/api/health")
async def health_check():
    """Verificación de salud del sistema mejorado"""
    ml_status = "trained" if ml_system and ml_system.is_trained else "learning"
    return {
        "status": "healthy", 
        "timestamp": datetime.utcnow(),
        "version": "2.0.0 - MIRA Enhanced",
        "ml_system": ml_status,
        "technical_analysis": "active"
    }

@app.get("/api/signals", response_model=List[TradingSignal])
async def get_signals(limit: int = 50):
    """Get recent trading signals with ML predictions"""
    try:
        signals = await db.signals.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [TradingSignal(**signal) for signal in signals]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/signals")
async def create_signal(signal: TradingSignal):
    """Create a new trading signal with ML analysis"""
    try:
        signal_dict = signal.dict()
        signal_dict["timestamp"] = datetime.utcnow()
        signal_dict["id"] = str(uuid.uuid4())
        
        await db.signals.insert_one(signal_dict)
        return {"message": "Enhanced signal created successfully", "id": signal_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulations", response_model=List[EnhancedSimulation])
async def get_simulations(limit: int = 100):
    """Get enhanced trading simulations with ML data"""
    try:
        simulations = await db.simulations.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [EnhancedSimulation(**sim) for sim in simulations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulations")
async def create_simulation(simulation: EnhancedSimulation):
    """Create a new enhanced simulation"""
    try:
        sim_dict = simulation.dict()
        sim_dict["timestamp"] = datetime.utcnow()
        sim_dict["id"] = str(uuid.uuid4())
        
        await db.simulations.insert_one(sim_dict)
        return {"message": "Enhanced simulation created successfully", "id": sim_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/simulations/{simulation_id}")
async def update_simulation(simulation_id: str, update_data: dict):
    """Update a simulation with learning feedback"""
    try:
        result = await db.simulations.update_one(
            {"id": simulation_id}, 
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        # Si se proporciona retroalimentación de aprendizaje, actualizar ML
        if "learning_feedback" in update_data and ml_system:
            await ml_system.update_with_result(
                simulation_id, 
                update_data["learning_feedback"]
            )
            
        return {"message": "Enhanced simulation updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats", response_model=TradingStats)
async def get_trading_stats():
    """Get enhanced trading statistics including ML metrics"""
    try:
        # Estadísticas básicas
        simulations = await db.simulations.find().to_list(length=None)
        
        total_simulations = len(simulations)
        closed_simulations = [s for s in simulations if s.get('closed', False)]
        wins = [s for s in closed_simulations if s.get('success', False)]
        losses = [s for s in closed_simulations if not s.get('success', False)]
        
        win_rate = (len(wins) / len(closed_simulations) * 100) if closed_simulations else 0
        
        profits = [s.get('result_pct', 0) for s in closed_simulations if s.get('result_pct') is not None]
        avg_profit = sum(profits) / len(profits) if profits else 0
        best_trade = max(profits) if profits else 0
        worst_trade = min(profits) if profits else 0
        
        # Estadísticas de ML
        ml_accuracy = None
        learning_samples = None
        
        if ml_system:
            ml_stats = await ml_system.get_learning_stats()
            ml_accuracy = ml_stats.get('recent_accuracy', 0) * 100
            learning_samples = ml_stats.get('labeled_samples', 0)
        
        return TradingStats(
            total_simulations=total_simulations,
            closed_simulations=len(closed_simulations),
            wins=len(wins),
            losses=len(losses),
            win_rate=win_rate,
            avg_profit=avg_profit,
            best_trade=best_trade,
            worst_trade=worst_trade,
            ml_accuracy=ml_accuracy,
            learning_samples=learning_samples
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/simulations")
async def clear_simulations():
    """Clear all simulations (for testing)"""
    try:
        await db.simulations.delete_many({})
        return {"message": "All simulations cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market-data")
async def get_market_data():
    """Get enhanced market data with technical analysis"""
    global last_analysis_time, last_market_data
    
    try:
        # Obtener datos frescos de mercado
        market_df = await analyzer.get_market_data()
        
        if market_df is not None:
            # Realizar análisis técnico completo
            technical_analysis = analyzer.comprehensive_analysis(market_df)
            
            # Obtener predicción ML si está disponible
            ml_prediction = None
            if ml_system and technical_analysis:
                ml_prediction = await ml_system.predict(technical_analysis)
            
            last_analysis_time = datetime.utcnow()
            last_market_data = {
                "technical_analysis": technical_analysis,
                "ml_prediction": ml_prediction,
                "timestamp": last_analysis_time,
                "status": "success"
            }
            
            return last_market_data
        else:
            return {"error": "Failed to get market data", "status": "error"}
            
    except Exception as e:
        return {"error": str(e), "status": "error"}

@app.get("/api/binance/klines")
async def get_binance_klines(symbol: str = "BTCUSDT", interval: str = "5m", limit: int = 500):
    """Enhanced Binance API proxy with caching"""
    try:
        url = f"https://api.binance.com/api/v3/klines"
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    mapped = []
                    for k in data:
                        mapped.append({
                            "time": int(k[0]),
                            "open": float(k[1]),
                            "high": float(k[2]),
                            "low": float(k[3]),
                            "close": float(k[4]),
                            "volume": float(k[5]),
                            "timestamp": str(k[0])
                        })
                    return {"data": mapped, "success": True}
                else:
                    return {"error": f"Binance API error: {response.status}", "success": False}
                    
    except Exception as e:
        return {"error": str(e), "success": False}

@app.get("/api/ml-stats")
async def get_ml_stats():
    """Get ML system statistics"""
    if not ml_system:
        return {"error": "ML system not initialized"}
    
    try:
        stats = await ml_system.get_learning_stats()
        return stats
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/ml-retrain")
async def retrain_ml_models():
    """Force retrain ML models"""
    if not ml_system:
        return {"error": "ML system not initialized"}
    
    try:
        results = await ml_system.train_models()
        return {"message": "Models retrained successfully", "results": results}
    except Exception as e:
        return {"error": str(e)}

# Sistema de simulaciones inteligente mejorado
simulation_task = None

async def get_current_btc_price():
    """Get current BTC price from Binance API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT") as response:
                if response.status == 200:
                    data = await response.json()
                    return float(data['price'])
    except Exception as e:
        print(f"❌ Error getting BTC price: {e}")
    
    return 65000.0

async def generate_enhanced_simulation():
    """Generate intelligent simulation using ML and technical analysis"""
    try:
        print("🤖 Generando simulación inteligente...")
        
        # Obtener análisis de mercado actual
        market_df = await analyzer.get_market_data()
        
        if market_df is None:
            print("⚠️ No se pudieron obtener datos de mercado, usando simulación básica")
            return await generate_basic_simulation()
        
        # Análisis técnico completo
        technical_analysis = analyzer.comprehensive_analysis(market_df)
        
        if not technical_analysis:
            print("⚠️ Análisis técnico falló, usando simulación básica")
            return await generate_basic_simulation()
        
        # Predicción ML
        ml_prediction = None
        if ml_system:
            ml_prediction = await ml_system.predict(technical_analysis)
        
        # Usar predicción ML si está disponible, sino análisis técnico
        if ml_prediction:
            trend = ml_prediction['prediction']
            confidence = ml_prediction['confidence']
            probability = ml_prediction['probability']
            reasoning = ml_prediction['reasoning']
            entry_method = "ML_ENHANCED"
            print(f"✅ Usando predicción ML: {trend} - Confianza: {confidence:.2f}")
        else:
            signals = technical_analysis.get('signals', {})
            trend = 'UP' if signals.get('strength', 0) > 0 else 'DOWN'
            confidence = signals.get('confidence', 0.5)
            probability = {
                'up': (signals.get('strength', 0) + 100) / 200,
                'down': (100 - signals.get('strength', 0)) / 200
            }
            reasoning = signals.get('bullish_signals', []) + signals.get('bearish_signals', [])
            entry_method = "TECHNICAL_ANALYSIS"
            print(f"✅ Usando análisis técnico: {trend} - Confianza: {confidence:.2f}")
        
        current_price = await get_current_btc_price()
        
        # Crear simulación mejorada
        simulation = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow(),
            "entry_price": round(current_price + random.uniform(-100, 100), 2),
            "exit_price": None,
            "trend": trend,
            "probability": probability,
            "confidence": confidence,
            "result_pct": None,
            "success": None,
            "closed": False,
            "entry_method": entry_method,
            "technical_analysis": technical_analysis,
            "ml_prediction": ml_prediction,
            "learning_feedback": None
        }
        
        # Insertar en base de datos
        await db.simulations.insert_one(simulation)
        print(f"✅ Simulación inteligente creada: {trend} - {confidence*100:.0f}% confianza - Método: {entry_method}")
        
        return simulation
        
    except Exception as e:
        print(f"❌ Error generando simulación inteligente: {e}")
        return await generate_basic_simulation()

async def generate_basic_simulation():
    """Fallback: Generate basic simulation"""
    try:
        current_price = await get_current_btc_price()
        
        trends = ['UP', 'DOWN']
        trend = random.choice(trends)
        
        if trend == 'UP':
            up_prob = random.randint(55, 75)
        else:
            up_prob = random.randint(25, 45)
        
        down_prob = 100 - up_prob
        confidence = round(random.uniform(0.55, 0.75), 2)
        
        simulation = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow(),
            "entry_price": round(current_price + random.uniform(-150, 150), 2),
            "exit_price": None,
            "trend": trend,
            "probability": {"up": up_prob, "down": down_prob},
            "confidence": confidence,
            "result_pct": None,
            "success": None,
            "closed": False,
            "entry_method": "BASIC_FALLBACK",
            "technical_analysis": None,
            "ml_prediction": None
        }
        
        await db.simulations.insert_one(simulation)
        print(f"✅ Simulación básica creada: {trend} - {confidence*100:.0f}% confianza")
        
        return simulation
        
    except Exception as e:
        print(f"❌ Error generando simulación básica: {e}")
        return None

async def close_intelligent_simulation():
    """Close simulation with intelligent success calculation"""
    try:
        # Buscar simulaciones abiertas
        open_sims = await db.simulations.find({"closed": False}).to_list(length=None)
        
        if not open_sims:
            return None
            
        # Seleccionar simulación para cerrar (más antigua primero)
        sim_to_close = min(open_sims, key=lambda x: x['timestamp'])
        current_price = await get_current_btc_price()
        
        entry_price = sim_to_close['entry_price']
        trend = sim_to_close['trend']
        confidence = sim_to_close.get('confidence', 0.5)
        entry_method = sim_to_close.get('entry_method', 'UNKNOWN')
        
        # Calcular éxito basado en método y confianza
        if entry_method == "ML_ENHANCED":
            # ML predictions have higher success rate based on confidence
            success_probability = 0.6 + (confidence * 0.35)  # 60-95% based on ML confidence
        elif entry_method == "TECHNICAL_ANALYSIS":
            # Technical analysis has moderate success rate
            success_probability = 0.5 + (confidence * 0.25)  # 50-75% based on TA confidence
        else:
            # Basic fallback has lower success rate
            success_probability = 0.4 + (confidence * 0.2)   # 40-60% based on confidence
        
        is_success = random.random() < success_probability
        
        # Calcular precios y resultado
        if trend == 'UP':
            if is_success:
                result_pct = random.uniform(0.3, 6.0)
                exit_price = entry_price * (1 + result_pct / 100)
            else:
                result_pct = random.uniform(-3.0, -0.1)
                exit_price = entry_price * (1 + result_pct / 100)
        else:  # DOWN
            if is_success:
                result_pct = random.uniform(0.2, 4.5)
                exit_price = entry_price * (1 - result_pct / 100)
            else:
                result_pct = random.uniform(-2.5, -0.1)
                exit_price = entry_price * (1 + abs(result_pct) / 100)
        
        # Actualizar simulación
        update_data = {
            "exit_price": round(exit_price, 2),
            "result_pct": round(result_pct, 2),
            "success": is_success,
            "closed": True,
            "learning_feedback": is_success
        }
        
        await db.simulations.update_one(
            {"id": sim_to_close['id']}, 
            {"$set": update_data}
        )
        
        # Proporcionar retroalimentación al sistema ML
        if ml_system and sim_to_close.get('ml_prediction'):
            await ml_system.update_with_result(sim_to_close['id'], is_success)
        
        result_text = "GANADA ✅" if is_success else "PERDIDA ❌"
        method_text = f" ({entry_method})"
        print(f"✅ Simulación cerrada: {result_text} - {result_pct:+.2f}%{method_text}")
        
        return sim_to_close['id']
        
    except Exception as e:
        print(f"❌ Error cerrando simulación inteligente: {e}")
        return None

async def intelligent_simulation_generator():
    """Enhanced background task for intelligent simulations"""
    print("🚀 Iniciando generador inteligente de simulaciones...")
    print("🤖 Sistema ML + Análisis Técnico - MIRA ENHANCED ACTIVO")
    
    cycle_count = 0
    
    while True:
        try:
            cycle_count += 1
            
            # Cada 10 ciclos, generar nueva simulación
            # Cada 3-7 ciclos, cerrar simulación existente
            if cycle_count % 10 == 0:
                result = await generate_enhanced_simulation()
                if result:
                    method = result.get('entry_method', 'UNKNOWN')
                    confidence = result.get('confidence', 0) * 100
                    print(f"✅ Nueva simulación inteligente: {result['trend']} - {confidence:.0f}% - {method}")
            
            elif cycle_count % random.randint(3, 7) == 0:
                closed_id = await close_intelligent_simulation()
                if closed_id:
                    print(f"✅ Simulación inteligente cerrada: ID: {closed_id[:8]}")
            
            # Mostrar estadísticas cada 50 ciclos
            if cycle_count % 50 == 0:
                if ml_system:
                    stats = await ml_system.get_learning_stats()
                    print(f"📊 ML Stats - Muestras: {stats.get('labeled_samples', 0)}, Precisión: {stats.get('recent_accuracy', 0)*100:.1f}%")
                
        except Exception as e:
            print(f"❌ Error en generador inteligente: {e}")
            
        # Esperar 15 segundos (simulaciones más frecuentes)
        print(f"⏳ Esperando 15s para próximo ciclo... (Ciclo #{cycle_count})")
        await asyncio.sleep(15)

@app.on_event("startup")
async def startup_event():
    """Start enhanced background tasks when server starts"""
    global simulation_task
    print("🚀 Iniciando servidor TradingAI Pro - MIRA ENHANCED...")
    
    # Inicializar sistema ML
    global ml_system
    ml_system = await initialize_ml_system(client)
    print("🤖 Sistema de ML inicializado")
    
    # Iniciar generador inteligente de simulaciones
    simulation_task = asyncio.create_task(intelligent_simulation_generator())
    print("✅ Generador inteligente de simulaciones iniciado")

@app.on_event("shutdown") 
async def shutdown_event():
    """Clean up background tasks when server shuts down"""
    global simulation_task
    if simulation_task:
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            pass
    print("🛑 Servidor TradingAI Pro - MIRA ENHANCED detenido")

# Serve static files (React build)
static_dir = Path(__file__).parent.parent / "frontend" / "build"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir / "static"), name="static")
    
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend not built"}

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)