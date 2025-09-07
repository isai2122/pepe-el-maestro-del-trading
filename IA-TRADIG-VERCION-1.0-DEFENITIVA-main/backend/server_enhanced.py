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

# Importar nuestros sistemas mejorados independientes
from technical_analysis import analyzer
from enhanced_ml_system import initialize_enhanced_ml_system, enhanced_ml_system
from advanced_ai_system import initialize_error_learning_system, error_learning_system

app = FastAPI(title="TradingAI Pro API - MIRA ENHANCED v2.0", version="2.0.0")

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

# Pydantic models actualizados
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
    entry_method: str = "ML_ENHANCED_AUTO"
    technical_analysis: Optional[dict] = None
    ml_prediction: Optional[dict] = None
    learning_feedback: Optional[bool] = None

class AdvancedTradingStats(BaseModel):
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
    system_version: str = "MIRA_Enhanced_v2.0"
    error_learning_active: bool = True
    progress_to_90_percent: float = 0.0

# Sistema de predicciones mejorado
prediction_history = []
last_analysis_time = None
last_market_data = None

# API endpoints mejorados
@app.get("/api/health")
async def health_check():
    """Verificación de salud del sistema mejorado"""
    system_status = "trained" if enhanced_ml_system and enhanced_ml_system.is_trained else "learning"
    error_learning_status = "active" if error_learning_system else "inactive"
    
    return {
        "status": "healthy", 
        "timestamp": datetime.utcnow(),
        "version": "2.0.0 - MIRA Enhanced with Error Learning",
        "enhanced_ml_system": system_status,
        "error_learning_system": error_learning_status,
        "technical_analysis": "active"
    }

@app.get("/api/signals", response_model=List[TradingSignal])
async def get_signals(limit: int = 50):
    """Get recent trading signals with enhanced ML predictions"""
    try:
        signals = await db.signals.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [TradingSignal(**signal) for signal in signals]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/signals")
async def create_signal(signal: TradingSignal):
    """Create a new trading signal with enhanced ML analysis"""
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
    """Get enhanced trading simulations with advanced ML data"""
    try:
        # Intentar primero enhanced_simulations, luego simulations como fallback
        simulations = await db.enhanced_simulations.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        if not simulations:
            simulations = await db.simulations.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [EnhancedSimulation(**sim) for sim in simulations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulations")
async def create_simulation(simulation: EnhancedSimulation):
    """Create a new enhanced simulation with advanced learning"""
    try:
        sim_dict = simulation.dict()
        sim_dict["timestamp"] = datetime.utcnow()
        sim_dict["id"] = str(uuid.uuid4())
        
        await db.enhanced_simulations.insert_one(sim_dict)
        return {"message": "Enhanced simulation created successfully", "id": sim_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)