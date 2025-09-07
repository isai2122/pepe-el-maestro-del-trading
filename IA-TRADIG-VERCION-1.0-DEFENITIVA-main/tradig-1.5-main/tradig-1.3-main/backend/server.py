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
import random

app = FastAPI(title="TradingAI Pro API", version="1.0.0")

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

class Simulation(BaseModel):
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
    entry_method: str = "AUTO"

class TradingStats(BaseModel):
    total_simulations: int
    closed_simulations: int
    wins: int
    losses: int
    win_rate: float
    avg_profit: float
    best_trade: float
    worst_trade: float

# API endpoints
@app.get("/")
async def root():
    return {"message": "TradingAI Pro API", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/api/signals", response_model=List[TradingSignal])
async def get_signals(limit: int = 50):
    """Get recent trading signals"""
    try:
        signals = await db.signals.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [TradingSignal(**signal) for signal in signals]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/signals")
async def create_signal(signal: TradingSignal):
    """Create a new trading signal"""
    try:
        signal_dict = signal.dict()
        signal_dict["timestamp"] = datetime.utcnow()
        signal_dict["id"] = str(uuid.uuid4())
        
        await db.signals.insert_one(signal_dict)
        return {"message": "Signal created successfully", "id": signal_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulations", response_model=List[Simulation])
async def get_simulations(limit: int = 100):
    """Get trading simulations"""
    try:
        simulations = await db.simulations.find().sort("timestamp", -1).limit(limit).to_list(length=None)
        return [Simulation(**sim) for sim in simulations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulations")
async def create_simulation(simulation: Simulation):
    """Create a new simulation"""
    try:
        sim_dict = simulation.dict()
        sim_dict["timestamp"] = datetime.utcnow()
        sim_dict["id"] = str(uuid.uuid4())
        
        await db.simulations.insert_one(sim_dict)
        return {"message": "Simulation created successfully", "id": sim_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/simulations/{simulation_id}")
async def update_simulation(simulation_id: str, update_data: dict):
    """Update a simulation (for closing trades)"""
    try:
        result = await db.simulations.update_one(
            {"id": simulation_id}, 
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Simulation not found")
            
        return {"message": "Simulation updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats", response_model=TradingStats)
async def get_trading_stats():
    """Get trading statistics"""
    try:
        # Get all simulations
        simulations = await db.simulations.find().to_list(length=None)
        
        total_simulations = len(simulations)
        closed_simulations = [s for s in simulations if s.get('closed', False)]
        wins = [s for s in closed_simulations if s.get('success', False)]
        losses = [s for s in closed_simulations if not s.get('success', False)]
        
        win_rate = (len(wins) / len(closed_simulations) * 100) if closed_simulations else 0
        
        # Calculate profit statistics
        profits = [s.get('result_pct', 0) for s in closed_simulations if s.get('result_pct') is not None]
        avg_profit = sum(profits) / len(profits) if profits else 0
        best_trade = max(profits) if profits else 0
        worst_trade = min(profits) if profits else 0
        
        return TradingStats(
            total_simulations=total_simulations,
            closed_simulations=len(closed_simulations),
            wins=len(wins),
            losses=len(losses),
            win_rate=win_rate,
            avg_profit=avg_profit,
            best_trade=best_trade,
            worst_trade=worst_trade
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
    """Proxy for market data if needed"""
    return {"message": "Market data endpoint - implement as needed"}

@app.get("/api/binance/klines")
async def get_binance_klines(symbol: str = "BTCUSDT", interval: str = "5m", limit: int = 500):
    """Proxy Binance API to avoid CORS issues"""
    import aiohttp
    
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
                    # Transform data to our format
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

# Automatic simulation generation
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
        print(f"Error getting BTC price: {e}")
    
    # Fallback price if API fails
    return 65000.0

async def generate_simulation():
    """Generate a new trading simulation"""
    try:
        current_price = await get_current_btc_price()
        
        # Generate random trend and probabilities
        trends = ['UP', 'DOWN']
        trend = random.choice(trends)
        
        if trend == 'UP':
            up_prob = random.randint(55, 85)
        else:
            up_prob = random.randint(15, 45)
        
        down_prob = 100 - up_prob
        confidence = round(random.uniform(0.65, 0.92), 2)
        
        # Create new simulation
        simulation = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow(),
            "entry_price": round(current_price + random.uniform(-200, 200), 2),
            "exit_price": None,
            "trend": trend,
            "probability": {"up": up_prob, "down": down_prob},
            "confidence": confidence,
            "result_pct": None,
            "success": None,
            "closed": False,
            "entry_method": random.choice(["AUTO", "SIGNAL", "MANUAL"])
        }
        
        # Insert into database
        await db.simulations.insert_one(simulation)
        print(f"✅ Nueva simulación generada: {trend} - {confidence*100:.0f}% confianza")
        
        return simulation
        
    except Exception as e:
        print(f"Error generating simulation: {e}")
        return None

async def close_random_simulation():
    """Close a random open simulation"""
    try:
        # Find open simulations
        open_sims = await db.simulations.find({"closed": False}).to_list(length=None)
        
        if not open_sims:
            return None
            
        # Select random simulation to close
        sim_to_close = random.choice(open_sims)
        current_price = await get_current_btc_price()
        
        # Calculate exit price and result
        entry_price = sim_to_close['entry_price']
        trend = sim_to_close['trend']
        confidence = sim_to_close['confidence']
        
        # Higher confidence = higher success probability
        success_probability = 0.5 + (confidence * 0.3)  # 50-80% based on confidence
        is_success = random.random() < success_probability
        
        if trend == 'UP':
            if is_success:
                # Successful UP trade
                result_pct = random.uniform(0.5, 8.0)
                exit_price = entry_price * (1 + result_pct / 100)
            else:
                # Failed UP trade
                result_pct = random.uniform(-4.0, -0.2)
                exit_price = entry_price * (1 + result_pct / 100)
        else:  # DOWN
            if is_success:
                # Successful DOWN trade (price went down, so we profit)
                result_pct = random.uniform(0.3, 6.0)
                exit_price = entry_price * (1 - result_pct / 100)
            else:
                # Failed DOWN trade (price went up)
                result_pct = random.uniform(-3.0, -0.1)
                exit_price = entry_price * (1 + abs(result_pct) / 100)
        
        # Update simulation
        update_data = {
            "exit_price": round(exit_price, 2),
            "result_pct": round(result_pct, 2),
            "success": is_success,
            "closed": True
        }
        
        await db.simulations.update_one(
            {"id": sim_to_close['id']}, 
            {"$set": update_data}
        )
        
        result_text = "GANADA" if is_success else "PERDIDA"
        print(f"✅ Simulación cerrada: {result_text} - {result_pct:+.2f}%")
        
        return sim_to_close['id']
        
    except Exception as e:
        print(f"Error closing simulation: {e}")
        return None

async def simulation_generator():
    """Background task to generate and close simulations every 30 seconds"""
    print("🚀 Iniciando generador automático de simulaciones...")
    
    while True:
        try:
            # Every cycle: 60% chance to generate new, 40% chance to close existing
            if random.random() < 0.6:
                await generate_simulation()
            else:
                await close_random_simulation()
                
        except Exception as e:
            print(f"Error in simulation generator: {e}")
            
        # Wait 30 seconds before next simulation
        await asyncio.sleep(30)

@app.on_event("startup")
async def startup_event():
    """Start background tasks when server starts"""
    global simulation_task
    print("🚀 Iniciando servidor TradingAI Pro...")
    
    # Start simulation generator
    simulation_task = asyncio.create_task(simulation_generator())

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
    print("🛑 Servidor TradingAI Pro detenido")

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